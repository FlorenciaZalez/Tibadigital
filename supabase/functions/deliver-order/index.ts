/// <reference path="../_shared/edge-runtime.d.ts" />

// Edge function: entrega las keys de un pedido pagado por email + (opcional) WhatsApp
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { formatDeliveredAccountContent, parseAccountFields } from "../_shared/accountContent.ts";
import { isGoogleSheetsSyncConfigured, syncGoogleSheetCheckboxes } from "../_shared/googleSheets.ts";
import { extractSourceCodeFromContent, extractSourceCodeFromNotes, stripSourceMetadata } from "../_shared/sourceMetadata.ts";
import { buildDeliveryEmailHtml, buildDeliveryEmailText, type DeliveryEmailItem, type DeliveryEmailTemplateData, type DeliveryInstruction } from "../../../shared/deliveryEmailTemplate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const STORE_NAME = Deno.env.get("STORE_NAME") ?? "TIBADIGITAL";
const PUBLIC_SITE_URL = Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "");
const EMAIL_LOGO_URL = Deno.env.get("EMAIL_LOGO_URL") ?? (PUBLIC_SITE_URL ? `${PUBLIC_SITE_URL}/logo.png` : null);
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "TIBADIGITAL <onboarding@resend.dev>";
const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO");
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM"); // ej: whatsapp:+14155238886

const replaceGoogleSheetsSummary = (notes: string | null | undefined, summary: string) => {
  const cleanNotes = (notes ?? "").replace(/\s*·\s*Google Sheets:.*$/i, "").trim();
  return cleanNotes ? `${cleanNotes} · ${summary}` : summary;
};

const formatOrderDate = (value: string) => new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
}).format(new Date(value));

const syncVisibleStock = async (supabase: ReturnType<typeof createClient>, productIds: string[]) => {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  if (uniqueProductIds.length === 0) return;

  const { data: keyRows, error: keyError } = await supabase
    .from("product_keys")
    .select("product_id")
    .in("product_id", uniqueProductIds)
    .eq("status", "available");

  if (keyError) throw keyError;

  const counts = new Map<string, number>();
  uniqueProductIds.forEach((productId) => counts.set(productId, 0));
  keyRows?.forEach((row: { product_id: string }) => counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1));

  for (const productId of uniqueProductIds) {
    const { error } = await supabase
      .from("products")
      .update({ stock: counts.get(productId) ?? 0 })
      .eq("id", productId);

    if (error) throw error;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get("Authorization");
    const accessToken = authHeader?.replace("Bearer ", "").trim();
    if (!accessToken) return json({ error: "No auth" }, 401);

    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id required" }, 400);

    const { data: order, error: oErr } = await supabase
      .from("orders").select("*, order_items(*)").eq("id", order_id).single();
    if (oErr || !order) return json({ error: "Order not found" }, 404);

    const orderProductIds = Array.from(new Set(order.order_items.map((item: { product_id: string | null }) => item.product_id).filter(Boolean)));
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("id, title, account_tier, platform")
      .in("id", orderProductIds);

    if (productsError) return json({ error: productsError.message }, 500);

    const productById = new Map<string, { title: string; account_tier: string | null; platform: string | null }>();
    (productsData ?? []).forEach((product: { id: string; title: string; account_tier: string | null; platform: string | null }) => {
      productById.set(product.id, product);
    });

    const { data: instructionRows, error: instructionError } = await supabase
      .from("account_tier_instructions")
      .select("tier, platform, instruction_text, image_url")
      .in("tier", ["primary", "secondary", "plus"]);

    if (instructionError) return json({ error: instructionError.message }, 500);

    const instructionByTierPlatform = new Map<string, DeliveryInstruction>();
    (instructionRows ?? []).forEach((row: { tier: string; platform: string; instruction_text: string; image_url: string | null }) => {
      if (!row.instruction_text?.trim() && !row.image_url) return;

      instructionByTierPlatform.set(`${row.tier}:${normalizeInstructionPlatform(row.platform)}`, {
        title: `Instructivo ${getInstructionTierLabel(row.tier)} ${normalizeInstructionPlatform(row.platform)}`,
        platform: normalizeInstructionPlatform(row.platform),
        text: row.instruction_text ?? "",
        imageUrl: row.image_url,
      });
    });

    if (accessToken !== SERVICE_KEY) {
      const { data: { user }, error: userErr } = await supabase.auth.getUser(accessToken);
      if (userErr || !user) return json({ error: "Invalid auth" }, 401);
      if (user.id !== order.user_id) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!roleRow) return json({ error: "Forbidden" }, 403);
      }
    }

    // Email del usuario
    const { data: userData } = await supabase.auth.admin.getUserById(order.user_id);
    const email = userData?.user?.email ?? null;

    const { data: profile } = await supabase
      .from("profiles").select("full_name, whatsapp").eq("user_id", order.user_id).single();

    const alreadyDelivered = order.status === "delivered";

    // Reservar y obtener una key disponible por cada item, o reutilizar las ya entregadas para reintentos de sync.
    const deliveredItems: { title: string; key: any; productId: string | null }[] = [];
    if (alreadyDelivered) {
      const { data: deliveredKeys, error: deliveredKeysError } = await supabase
        .from("product_keys")
        .select("*")
        .eq("reserved_for_order_id", order_id)
        .eq("status", "delivered")
        .order("delivered_at", { ascending: true });

      if (deliveredKeysError) return json({ error: deliveredKeysError.message }, 500);

      const fallbackTitle = order.order_items[0]?.product_title ?? "Producto";
      (deliveredKeys ?? []).forEach((key: Record<string, any>) => {
        const productInfo = key.product_id ? productById.get(key.product_id) : null;
        deliveredItems.push({ title: productInfo?.title ?? fallbackTitle, key, productId: key.product_id ?? null });
      });
    } else {
      for (const item of order.order_items) {
        for (let i = 0; i < item.quantity; i++) {
          if (!item.product_id) {
            deliveredItems.push({ title: item.product_title, key: null, productId: null });
            continue;
          }

          const { data: avail } = await supabase
            .from("product_keys")
            .select("*")
            .eq("product_id", item.product_id)
            .eq("status", "available")
            .limit(1)
            .maybeSingle();

          if (avail) {
            await supabase.from("product_keys").update({
              status: "delivered",
              reserved_for_order_id: order_id,
              delivered_to_user_id: order.user_id,
              delivered_at: new Date().toISOString(),
            }).eq("id", avail.id);
            deliveredItems.push({ title: item.product_title, key: avail, productId: item.product_id });
          } else {
            deliveredItems.push({ title: item.product_title, key: null, productId: item.product_id });
          }
        }
      }
    }

    let sheetsSyncSummary = "Google Sheets: no configurado";
    const deliveredSourceCodes = deliveredItems
      .flatMap(({ key }) => {
        const sourceCode = key?.source_code ?? extractSourceCodeFromNotes(key?.notes) ?? extractSourceCodeFromContent(key?.content);
        return sourceCode ? [sourceCode] : [];
      });

    if (deliveredSourceCodes.length > 0 && isGoogleSheetsSyncConfigured()) {
      try {
        const syncResult = await syncGoogleSheetCheckboxes(deliveredSourceCodes);
        sheetsSyncSummary = `Google Sheets: OK ${syncResult.updatedCodes.length}`;
        if (syncResult.missingCodes.length > 0) {
          sheetsSyncSummary += ` · faltantes ${syncResult.missingCodes.join(", ")}`;
        }
      } catch (syncError) {
        sheetsSyncSummary = `Google Sheets: FAIL ${(syncError as Error).message}`;
      }
    } else if (deliveredSourceCodes.length === 0) {
      sheetsSyncSummary = "Google Sheets: sin source_code";
    }

    if (!alreadyDelivered) {
      await syncVisibleStock(supabase, order.order_items.map((item: { product_id: string | null }) => item.product_id).filter(Boolean));
    }

    const emailOrderCode = order.public_code ?? order.id.slice(0, 8).toUpperCase();
    const emailItems: DeliveryEmailItem[] = deliveredItems.map(({ title, key, productId }) => {
      if (!key) {
        return {
          kind: "out_of_stock",
          title,
          notes: "Sin stock disponible por el momento. Te contactamos en breve para resolverlo.",
        };
      }

      const cleanNotes = stripSourceMetadata(key.notes);
      const displayContent = key.key_type === "account"
        ? formatDeliveredAccountContent({ content: key.content, notes: key.notes, title })
        : key.content;
      const accountFields = key.key_type === "account" ? parseAccountFields(displayContent) : [];

      const tier = normalizeInstructionTier(productById.get(productId ?? "")?.account_tier ?? null);
      const instructionPlatform = resolveInstructionPlatform(accountFields, productById.get(productId ?? "")?.platform ?? null);
      const instruction = tier ? instructionByTierPlatform.get(`${tier}:${instructionPlatform}`) ?? null : null;

      if (key.key_type === "account") {
        return {
          kind: "account",
          title,
          fields: accountFields,
          notes: cleanNotes,
          instruction,
        };
      }

      return {
        kind: "key",
        title,
        value: displayContent,
        notes: cleanNotes,
      };
    });

    const emailContent: DeliveryEmailTemplateData = {
      storeName: STORE_NAME,
      logoUrl: EMAIL_LOGO_URL,
      orderCode: emailOrderCode,
      createdAtLabel: formatOrderDate(order.created_at),
      paymentMethodLabel: order.payment_method ?? "No informado",
      totalLabel: formatCurrency(Number(order.total ?? 0)),
      customerName: profile?.full_name ?? null,
      itemsSummary: order.order_items.map((item: { product_title: string; quantity: number; unit_price: number }) => ({
        title: item.product_title,
        quantity: item.quantity,
        totalLabel: formatCurrency(Number(item.unit_price) * item.quantity),
      })),
      deliveredItems: emailItems,
    };

    const html = buildDeliveryEmailHtml(emailContent);
    const text = buildDeliveryEmailText(emailContent);

    // Enviar email via Lovable AI Gateway → Resend-compatible (usamos directamente Resend si hubiera, o registramos)
    // Como no hay aún email infra, lo registramos y mandamos por console; queda preparado para Lovable Email
    let emailSent = false;
    let emailError: string | null = null;
    try {
      // Usar Lovable AI Gateway no aplica para email. Por ahora intentamos con Resend si está, sino marcamos pendiente.
      const RESEND = Deno.env.get("RESEND_API_KEY");
      if (!email) {
        emailError = "No email for user";
      } else if (RESEND) {
        const emailPayload: Record<string, unknown> = {
          from: EMAIL_FROM,
          to: [email],
          subject: `🎮 Tu pedido ${order.public_code} está listo`,
          html,
          text,
        };

        if (EMAIL_REPLY_TO) {
          emailPayload.reply_to = EMAIL_REPLY_TO;
        }

        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify(emailPayload),
        });
        emailSent = r.ok;
        if (!r.ok) emailError = await r.text();
      } else {
        emailError = "Email no configurado (sin RESEND_API_KEY ni Lovable Email).";
        console.log("DELIVERY EMAIL (no provider):", { to: email, text });
      }
    } catch (e) { emailError = (e as Error).message; }

    // Enviar WhatsApp via Twilio si está configurado y el cliente cargó número
    let waSent = false;
    let waError: string | null = null;
    const phone = order.whatsapp || profile?.whatsapp;
    if (phone && TWILIO_API_KEY && TWILIO_FROM) {
      try {
        const r = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: `whatsapp:${phone.startsWith("+") ? phone : "+" + phone}`,
            From: TWILIO_FROM,
            Body: text,
          }),
        });
        waSent = r.ok;
        if (!r.ok) waError = await r.text();
      } catch (e) { waError = (e as Error).message; }
    }

    await supabase.from("orders").update({
      status: "delivered",
      verification_notes: `${alreadyDelivered ? "Reenvio" : "Entregado"}. Email: ${emailSent ? "OK" : "FAIL " + emailError} · WhatsApp: ${waSent ? "OK" : phone ? "FAIL " + waError : "no number"} · ${sheetsSyncSummary}`,
    }).eq("id", order_id);

    return json({ delivered: true, email_sent: emailSent, whatsapp_sent: waSent, already_delivered: alreadyDelivered });
  } catch (e) {
    console.error("deliver-order error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function normalizeInstructionTier(value: string | null | undefined) {
  if (value === "secondary") return "secondary";
  if (value === "plus") return "plus";
  if (value === "primary" || value === "general") return "primary";
  return null;
}

function getInstructionTierLabel(value: string) {
  if (value === "secondary") return "Secundaria";
  if (value === "plus") return "Plus";
  return "Primaria";
}

function resolveInstructionPlatform(fields: { label: string; value: string }[], productPlatform: string | null | undefined) {
  const consoleField = fields.find((field) => field.label.toLowerCase() === "consola")?.value ?? "";
  return normalizeInstructionPlatform(consoleField || productPlatform);
}

function normalizeInstructionPlatform(value: string | null | undefined): "PS4" | "PS5" {
  const normalized = (value ?? "").toUpperCase();
  if (normalized.includes("PS4") && !normalized.includes("PS5")) return "PS4";
  return "PS5";
}
