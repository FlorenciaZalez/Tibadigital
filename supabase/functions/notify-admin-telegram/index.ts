// Edge function: envía notificación a Telegram cuando un cliente sube comprobante
// o cuando un pedido queda en revisión manual.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id required" }, 400);

    // Cargar orden con items
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .single();
    if (oErr || !order) return json({ error: "Order not found" }, 404);

    // Datos del cliente
    const { data: userData } = await supabase.auth.admin.getUserById(
      order.user_id,
    );
    const email = userData?.user?.email ?? "Sin email";

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, whatsapp")
      .eq("user_id", order.user_id)
      .single();

    const clientName = profile?.full_name || email;
    const whatsapp = order.whatsapp || profile?.whatsapp || "No proporcionó";

    // Productos
    const items = (order.order_items || [])
      .map(
        (i: any) =>
          `  • ${i.quantity}× ${i.product_title} — $${(Number(i.unit_price) * i.quantity).toFixed(2)}`,
      )
      .join("\n");

    // Método de pago legible
    const paymentLabels: Record<string, string> = {
      mercadopago: "💙 Mercado Pago",
      bank_transfer: "🏦 Transferencia Bancaria",
      binance: "🟡 Binance / Cripto",
    };
    const method =
      paymentLabels[order.payment_method] || order.payment_method || "No especificado";

    const amount = Number(order.exact_amount || order.total).toFixed(2);
    const status = order.verification_status || "manual_review";

    // Generar URL firmada del comprobante (válida 30 min)
    let proofLink = "";
    if (order.payment_proof_url) {
      const { data: signed } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(order.payment_proof_url, 60 * 30);
      if (signed?.signedUrl) proofLink = signed.signedUrl;
    }

    // Mensaje para Telegram
    const text =
      `🛒 *Nuevo pedido para revisar*\n\n` +
      `📋 *Pedido:* ${escTg(order.public_code)}\n` +
      `👤 *Cliente:* ${escTg(clientName)}\n` +
      `📱 *WhatsApp:* ${escTg(whatsapp)}\n` +
      `💰 *Monto:* $${amount}\n` +
      `💳 *Método:* ${method}\n` +
      `📊 *Estado:* ${status.replace("_", " ").toUpperCase()}\n\n` +
      `🎮 *Productos:*\n${items}\n` +
      (proofLink
        ? `\n📎 [Ver comprobante](${proofLink})\n`
        : "\n⚠️ Sin comprobante adjunto\n");

    // Botones inline: Aprobar / Rechazar
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ Aprobar y entregar",
            callback_data: `approve:${order.id}`,
          },
          { text: "❌ Rechazar", callback_data: `reject:${order.id}` },
        ],
      ],
    };

    // Enviar mensaje a Telegram
    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const tgRes = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_ADMIN_CHAT_ID,
        text,
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard,
      }),
    });

    const tgData = await tgRes.json();
    if (!tgData.ok) {
      console.error("Telegram error:", tgData);
      return json({ error: "Telegram send failed", detail: tgData }, 500);
    }

    return json({ sent: true, message_id: tgData.result.message_id });
  } catch (e) {
    console.error("notify-admin-telegram error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Escapa caracteres especiales de Markdown v1 de Telegram */
function escTg(s: string): string {
  return s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}
