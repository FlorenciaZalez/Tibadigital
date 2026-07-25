/* eslint-disable @typescript-eslint/triple-slash-reference */
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

const formatOrderDate = (value: string) => new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
}).format(new Date(value));

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
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleRow) return json({ error: "Only internal services or admins can deliver orders" }, 403);
    }

    if (order.status !== "paid" && order.status !== "delivered") {
      return json({ error: "Order is not paid" }, 409);
    }
    if (order.verification_status !== "verified") {
      return json({ error: "Payment is not verified" }, 409);
    }

    // Email del usuario
    const { data: userData, error: userLookupError } = await supabase.auth.admin.getUserById(order.user_id);
    const email = order.delivery_email ?? userData?.user?.email ?? null;
    if (!email) {
      await supabase.from("orders").update({
        fulfillment_error: `Email del comprador no disponible${userLookupError ? `: ${userLookupError.message}` : ""}`,
      }).eq("id", order_id);
    }

    const { data: profile } = await supabase
      .from("profiles").select("full_name, whatsapp").eq("user_id", order.user_id).single();

    const alreadyDelivered = order.status === "delivered";
    const { data: claimedKeys, error: claimError } = await supabase.rpc("claim_paid_order_keys", {
      _order_id: order_id,
    });
    if (claimError) {
      await supabase.from("orders").update({
        fulfillment_error: `Stock: ${claimError.message}`,
        verification_notes: `Pago verificado. Entrega pendiente por stock: ${claimError.message}`,
      }).eq("id", order_id);
      return json({ error: claimError.message, code: "STOCK_UNAVAILABLE" }, 409);
    }

    const fallbackTitle = order.order_items[0]?.product_title ?? "Producto";
    const deliveredItems = (claimedKeys ?? []).map((key: Record<string, unknown>) => {
      const productId = typeof key.product_id === "string" ? key.product_id : null;
      return {
        title: productId ? productById.get(productId)?.title ?? fallbackTitle : fallbackTitle,
        key,
        productId,
      };
    });

    if (deliveredItems.length !== order.order_items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)) {
      return json({ error: "Claimed stock does not match order quantity" }, 500);
    }

    let sheetsSyncSummary = "Google Sheets: no configurado";
    let sheetsSynced = Boolean(order.sheets_synced_at);
    const deliveredSourceCodes = deliveredItems
      .flatMap(({ key }) => {
        const sourceCode = key?.source_code ?? extractSourceCodeFromNotes(key?.notes) ?? extractSourceCodeFromContent(key?.content);
        return sourceCode ? [sourceCode] : [];
      });

    if (sheetsSynced) {
      sheetsSyncSummary = "Google Sheets: ya sincronizado";
    } else if (deliveredSourceCodes.length > 0 && isGoogleSheetsSyncConfigured()) {
      try {
        const syncResult = await syncGoogleSheetCheckboxes(deliveredSourceCodes);
        sheetsSyncSummary = `Google Sheets: OK ${syncResult.updatedCodes.length}`;
        if (syncResult.missingCodes.length > 0) {
          sheetsSyncSummary += ` · faltantes ${syncResult.missingCodes.join(", ")}`;
        } else {
          sheetsSynced = true;
        }
      } catch (syncError) {
        sheetsSyncSummary = `Google Sheets: FAIL ${(syncError as Error).message}`;
      }
    } else if (deliveredSourceCodes.length === 0) {
      sheetsSyncSummary = "Google Sheets: sin source_code";
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
    let emailSent = Boolean(order.email_sent_at);
    let emailError: string | null = null;
    try {
      // Usar Lovable AI Gateway no aplica para email. Por ahora intentamos con Resend si está, sino marcamos pendiente.
      const RESEND = Deno.env.get("RESEND_API_KEY");
      if (emailSent) {
        // An earlier attempt succeeded. Fulfillment retries must not duplicate credentials.
      } else if (!email) {
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
          headers: {
            Authorization: `Bearer ${RESEND}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `delivery-${order_id}`,
          },
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

    const fulfillmentErrors = [
      emailSent ? null : `Email: ${emailError ?? "falló"}`,
      sheetsSynced ? null : sheetsSyncSummary,
    ].filter(Boolean);
    const fulfilled = fulfillmentErrors.length === 0;

    await supabase.from("orders").update({
      status: fulfilled ? "delivered" : "paid",
      email_sent_at: emailSent ? order.email_sent_at ?? new Date().toISOString() : null,
      sheets_synced_at: sheetsSynced ? order.sheets_synced_at ?? new Date().toISOString() : null,
      fulfillment_error: fulfilled ? null : fulfillmentErrors.join(" · "),
      verification_notes: `${fulfilled ? "Entregado" : "Entrega pendiente"}. Email: ${emailSent ? "OK" : "FAIL " + emailError} · WhatsApp: ${waSent ? "OK" : phone ? "FAIL " + waError : "no number"} · ${sheetsSyncSummary}`,
    }).eq("id", order_id);

    if (!fulfilled) {
      return json({
        delivered: false,
        email_sent: emailSent,
        sheets_synced: sheetsSynced,
        whatsapp_sent: waSent,
        error: fulfillmentErrors.join(" · "),
      }, 503);
    }

    return json({ delivered: true, email_sent: emailSent, sheets_synced: sheetsSynced, whatsapp_sent: waSent, already_delivered: alreadyDelivered });
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
