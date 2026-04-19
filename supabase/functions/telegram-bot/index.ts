// Edge function: recibe webhooks de Telegram (callback_query de botones inline)
// Permite aprobar o rechazar pedidos directamente desde Telegram.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_ADMIN_CHAT_ID")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET"); // opcional

const DELIVERY_RETRY_DELAYS_MS = [0, 800, 1800];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const triggerDelivery = async (orderId: string) => {
  let lastError: Error | null = null;

  for (const delayMs of DELIVERY_RETRY_DELAYS_MS) {
    if (delayMs > 0) await wait(delayMs);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/deliver-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    const payload = await response.json().catch(() => null);
    if (response.ok && !payload?.error) {
      return payload;
    }

    lastError = new Error(payload?.error || `deliver-order failed (${response.status})`);
    console.error("telegram-bot delivery attempt failed", { orderId, delayMs, error: lastError.message });
  }

  throw lastError ?? new Error("deliver-order failed");
};

Deno.serve(async (req) => {
  // Solo aceptamos POST de Telegram
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verificación opcional de secret (se pasa como query param al registrar el webhook)
  if (WEBHOOK_SECRET) {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    if (secret !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const update = await req.json();

    // Solo procesamos callback_query (botones inline)
    if (!update.callback_query) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const cb = update.callback_query;
    const chatId = String(cb.message?.chat?.id);
    const messageId = cb.message?.message_id;
    const data = cb.callback_data as string; // "approve:uuid" o "reject:uuid"

    // Solo el admin puede interactuar
    if (chatId !== TELEGRAM_ADMIN_CHAT_ID) {
      await answerCallback(cb.id, "⛔ No autorizado");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const [action, orderId] = data.split(":");
    if (!orderId || !["approve", "reject"].includes(action)) {
      await answerCallback(cb.id, "❌ Acción inválida");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verificar que la orden existe y no está ya procesada
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, public_code, status, verification_status")
      .eq("id", orderId)
      .single();

    if (oErr || !order) {
      await answerCallback(cb.id, "❌ Pedido no encontrado");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (order.status === "delivered") {
      await answerCallback(cb.id, "ℹ️ Este pedido ya fue entregado");
      await editMessage(chatId, messageId, cb.message.text + "\n\n✅ *YA ENTREGADO*");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (order.status === "cancelled") {
      await answerCallback(cb.id, "ℹ️ Este pedido ya fue cancelado");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (action === "approve") {
      // Aprobar: marcar como pagado y verificado
      await supabase
        .from("orders")
        .update({
          status: "paid",
          verification_status: "verified",
          verification_notes: "Aprobado vía Telegram",
        })
        .eq("id", orderId);

      // Disparar entrega automática
      let deliveryOk = false;
      try {
        await triggerDelivery(orderId);
        deliveryOk = true;
      } catch (e) {
        console.error("Delivery call failed:", e);
      }

      const statusMsg = deliveryOk
        ? "✅ *APROBADO Y ENTREGADO*"
        : "⚠️ *APROBADO* pero la entrega automática falló. Revisá en el admin.";

      await answerCallback(cb.id, deliveryOk ? "✅ Aprobado y entregado" : "⚠️ Aprobado, entrega falló");
      await editMessage(chatId, messageId, cb.message.text + `\n\n${statusMsg}`);

    } else if (action === "reject") {
      // Rechazar: cancelar orden
      await supabase
        .from("orders")
        .update({
          status: "cancelled",
          verification_status: "rejected",
          verification_notes: "Rechazado vía Telegram",
        })
        .eq("id", orderId);

      await answerCallback(cb.id, "❌ Pedido rechazado");
      await editMessage(chatId, messageId, cb.message.text + "\n\n❌ *RECHAZADO*");
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("telegram-bot error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
    });
  }
});

/** Responde al callback_query (quita el spinner del botón) */
async function answerCallback(callbackQueryId: string, text: string) {
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    },
  );
}

/** Edita el mensaje original para mostrar el resultado y quitar los botones */
async function editMessage(chatId: string, messageId: number, newText: string) {
  await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: "Markdown",
        // No reply_markup → removes inline keyboard
      }),
    },
  );
}
