import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!MP_TOKEN) return json({ error: "MERCADOPAGO_ACCESS_TOKEN not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !user) return json({ error: "Invalid auth" }, 401);

    const { order_id, payment_id } = await req.json();
    if (!order_id || !payment_id) return json({ error: "order_id and payment_id required" }, 400);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderErr || !order) return json({ error: "Order not found" }, 404);
    if (order.verification_status === "verified") return json({ status: "approved", already_verified: true });

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const payment = await paymentRes.json();

    if (!paymentRes.ok) {
      console.error("get payment error:", payment);
      return json({ error: "Mercado Pago payment lookup failed", detail: payment }, 500);
    }

    const amountMatches = Math.abs(Number(payment.transaction_amount) - Number(order.total)) < 0.01;
    const referenceMatches = String(payment.external_reference || "") === String(order.id);

    if (!amountMatches || !referenceMatches) {
      return json({ error: "Payment does not match order" }, 400);
    }

    if (payment.status !== "approved") {
      await supabase.from("orders").update({
        verification_notes: `Mercado Pago status: ${payment.status}`,
      }).eq("id", order_id);
      return json({ status: payment.status === "pending" || payment.status === "in_process" ? "pending" : "failed" });
    }

    const { data: usedPayments } = await supabase
      .from("orders")
      .select("matched_payment_id")
      .not("matched_payment_id", "is", null);
    const usedIds = new Set((usedPayments || []).map((item: any) => item.matched_payment_id));
    if (usedIds.has(String(payment.id)) && String(order.matched_payment_id || "") !== String(payment.id)) {
      return json({ error: "Payment already matched to another order" }, 409);
    }

    await supabase.from("orders").update({
      status: "paid",
      verification_status: "verified",
      matched_payment_id: String(payment.id),
      verification_notes: "Pago confirmado por Mercado Pago",
    }).eq("id", order_id);

    await fetch(`${SUPABASE_URL}/functions/v1/deliver-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ order_id }),
    });

    return json({ status: "approved", payment_id: String(payment.id) });
  } catch (e) {
    console.error("confirm-mercadopago-payment error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}