// Edge function: verifica el pago en MercadoPago / Binance buscando por monto exacto
// y dispara la entrega si encuentra match.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

interface VerifyRequest {
  order_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: validar usuario
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth" }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !user) return json({ error: "Invalid auth" }, 401);

    const { order_id }: VerifyRequest = await req.json();
    if (!order_id) return json({ error: "order_id required" }, 400);

    // Cargar la orden
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderErr || !order) return json({ error: "Order not found" }, 404);
    if (order.verification_status === "verified") return json({ status: "already_verified" });
    if (!order.payment_proof_url) return json({ error: "No proof uploaded" }, 400);

    // Marcar como en verificación
    await supabase.from("orders").update({
      verification_status: "awaiting_verification",
      verification_attempted_at: new Date().toISOString(),
    }).eq("id", order_id);

    // Para métodos sin verificación automática (transferencia, binance sin API),
    // notificar directo a Telegram para revisión manual
    const autoVerifiable = order.payment_method === "mercadopago" && MP_TOKEN;
    if (!autoVerifiable) {
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/notify-admin-telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ order_id }),
        });
      } catch (e) {
        console.error("Telegram notification failed:", e);
      }
    }

    let matchedPayment: { id: string; provider: string } | null = null;

    // === MERCADOPAGO ===
    if (order.payment_method === "mercadopago" && MP_TOKEN) {
      try {
        // Buscar pagos aprobados recientes (últimas 48h)
        const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const url = `https://api.mercadopago.com/v1/payments/search?status=approved&begin_date=${encodeURIComponent(since)}&end_date=NOW&sort=date_created&criteria=desc&limit=50`;
        const mpRes = await fetch(url, { headers: { Authorization: `Bearer ${MP_TOKEN}` } });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          const exactAmount = Number(order.exact_amount);
          // Buscar pago con monto exacto que NO esté ya matcheado a otra orden
          const { data: usedPayments } = await supabase
            .from("orders").select("matched_payment_id").not("matched_payment_id", "is", null);
          const usedIds = new Set((usedPayments || []).map((o: any) => o.matched_payment_id));

          const candidate = (mpData.results || []).find((p: any) =>
            Math.abs(Number(p.transaction_amount) - exactAmount) < 0.01 &&
            !usedIds.has(String(p.id)) &&
            new Date(p.date_approved || p.date_created) > new Date(order.created_at)
          );
          if (candidate) matchedPayment = { id: String(candidate.id), provider: "mercadopago" };
        }
      } catch (e) {
        console.error("MP error:", e);
      }
    }

    // === BINANCE === (placeholder - requiere Binance Pay Merchant API)
    // Por ahora solo MercadoPago es automático; Binance queda manual.

    if (matchedPayment) {
      // Match encontrado: reservar key y disparar entrega
      await supabase.from("orders").update({
        verification_status: "verified",
        status: "paid",
        matched_payment_id: matchedPayment.id,
      }).eq("id", order_id);

      // Llamar a delivery
      await fetch(`${SUPABASE_URL}/functions/v1/deliver-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ order_id }),
      });

      return json({ status: "verified", payment_id: matchedPayment.id });
    }

    // Sin match: pasar a revisión manual
    await supabase.from("orders").update({
      verification_status: "manual_review",
      verification_notes: MP_TOKEN ? "No se encontró un pago con el monto exacto. Quedará en revisión manual." : "Verificación automática no disponible (token no configurado). Revisión manual.",
    }).eq("id", order_id);

    // Notificar a admin por Telegram
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/notify-admin-telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ order_id }),
      });
    } catch (e) {
      console.error("Telegram notification failed:", e);
    }

    return json({ status: "manual_review", message: "Pago no detectado automáticamente. La administradora lo revisará manualmente." });
  } catch (e) {
    console.error("verify-payment error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
