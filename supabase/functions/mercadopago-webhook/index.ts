import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  if (!MP_TOKEN) return json({ error: "Mercado Pago not configured" }, 500);

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const paymentId = String(
      body?.data?.id ?? body?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "",
    );

    // Mercado Pago also sends non-payment topics. Acknowledge those without mutation.
    const topic = String(body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
    if (!paymentId || (topic && topic !== "payment")) return json({ ok: true });

    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) return json({ error: "Payment lookup failed" }, 502);

    const orderId = String(payment.external_reference ?? payment.metadata?.order_id ?? "");
    if (!orderId) return json({ error: "Payment has no order reference" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total, payment_method, status, verification_status, matched_payment_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order || order.payment_method !== "mercadopago") {
      return json({ error: "Order not found" }, 404);
    }

    if (Math.abs(Number(payment.transaction_amount) - Number(order.total)) >= 0.01) {
      return json({ error: "Payment amount mismatch" }, 409);
    }

    if (payment.status !== "approved") {
      await supabase.from("orders").update({
        verification_notes: `Mercado Pago status: ${payment.status}`,
      }).eq("id", order.id);
      return json({ ok: true, status: payment.status });
    }

    if (order.matched_payment_id && order.matched_payment_id !== paymentId) {
      return json({ error: "Order already matched to another payment" }, 409);
    }

    const { error: paymentUpdateError } = await supabase.from("orders").update({
      status: "paid",
      verification_status: "verified",
      matched_payment_id: paymentId,
      verification_notes: "Pago confirmado por webhook de Mercado Pago",
    }).eq("id", order.id);

    if (paymentUpdateError) return json({ error: paymentUpdateError.message }, 409);

    const deliveryResponse = await fetch(`${SUPABASE_URL}/functions/v1/deliver-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ order_id: order.id }),
    });
    const delivery = await deliveryResponse.json().catch(() => null);

    if (!deliveryResponse.ok || delivery?.error) {
      await supabase.from("orders").update({
        fulfillment_error: delivery?.error ?? `deliver-order failed (${deliveryResponse.status})`,
      }).eq("id", order.id);
      // A non-2xx response asks Mercado Pago to retry the notification.
      return json({ error: delivery?.error ?? "Delivery failed" }, 503);
    }

    return json({ ok: true, delivered: true });
  } catch (error) {
    console.error("mercadopago-webhook error", error);
    return json({ error: (error as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
