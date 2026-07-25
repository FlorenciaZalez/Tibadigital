import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { toBinanceOrderMeta, verifyBinanceWebhookSignature } from "../_shared/binancePay.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DELIVERY_RETRY_DELAYS_MS = [0, 800, 1800];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const triggerDelivery = async (orderId: string) => {
  let lastError: Error | null = null;

  for (const delayMs of DELIVERY_RETRY_DELAYS_MS) {
    if (delayMs > 0) await wait(delayMs);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/deliver-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ order_id: orderId }),
    });

    const payload = await response.json().catch(() => null);
    if (response.ok && !payload?.error) {
      return payload;
    }

    lastError = new Error(payload?.error || `deliver-order failed (${response.status})`);
    console.error("binance-pay-webhook delivery attempt failed", { orderId, delayMs, error: lastError.message });
  }

  throw lastError ?? new Error("deliver-order failed");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return webhookResponse("FAIL", "Method not allowed", 405);

  const body = await req.text();

  try {
    await verifyBinanceWebhookSignature(body, req.headers);

    const payload = JSON.parse(body) as {
      bizType?: string;
      bizStatus?: string;
      bizIdStr?: string;
      data?: string;
    };

    if (payload.bizType !== "PAY" || !payload.data) {
      return webhookResponse("SUCCESS", null, 200);
    }

    const notificationData = JSON.parse(payload.data) as Record<string, unknown>;
    const merchantTradeNo = String(notificationData.merchantTradeNo ?? "");
    if (!merchantTradeNo) return webhookResponse("FAIL", "merchantTradeNo missing", 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, verification_status, payment_provider_meta")
      .contains("payment_provider_meta", { merchantTradeNo })
      .maybeSingle();

    if (error || !order) {
      console.error("binance-pay-webhook order lookup failed", { merchantTradeNo, error });
      return webhookResponse("FAIL", "order not found", 404);
    }

    const mergedMeta = toBinanceOrderMeta({
      ...(order.payment_provider_meta as Record<string, unknown> | null ?? {}),
      ...notificationData,
      prepayId: payload.bizIdStr ?? (order.payment_provider_meta as Record<string, unknown> | null)?.prepayId,
      status: payload.bizStatus === "PAY_SUCCESS" ? "PAID" : payload.bizStatus === "PAY_CLOSED" ? "CANCELED" : String(notificationData.status ?? "PENDING"),
    });

    if (payload.bizStatus === "PAY_SUCCESS") {
      const { error: paymentUpdateError } = await supabase.from("orders").update({
        status: "paid",
        verification_status: "verified",
        matched_payment_id: mergedMeta.transactionId ?? mergedMeta.prepayId,
        verification_notes: "Pago confirmado por Binance Pay",
        payment_provider_meta: mergedMeta,
      }).eq("id", order.id);
      if (paymentUpdateError) return webhookResponse("FAIL", paymentUpdateError.message, 409);

      if (order.status !== "delivered") {
        try {
          await triggerDelivery(order.id);
        } catch (deliveryError) {
          const message = (deliveryError as Error).message;
          await supabase.from("orders").update({ verification_notes: `Pago confirmado por Binance Pay. Entrega pendiente: ${message}` }).eq("id", order.id);
        }
      }

      return webhookResponse("SUCCESS", null, 200);
    }

    await supabase.from("orders").update({
      payment_provider_meta: mergedMeta,
      verification_notes: payload.bizStatus === "PAY_CLOSED" ? "Orden Binance Pay cerrada o vencida" : "Actualización recibida de Binance Pay",
    }).eq("id", order.id);

    return webhookResponse("SUCCESS", null, 200);
  } catch (error) {
    console.error("binance-pay-webhook error", error);
    return webhookResponse("FAIL", (error as Error).message, 400);
  }
});

function webhookResponse(returnCode: "SUCCESS" | "FAIL", returnMessage: string | null, status = 200) {
  return new Response(JSON.stringify({ returnCode, returnMessage }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
