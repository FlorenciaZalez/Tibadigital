import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    console.error("approve-order-admin delivery attempt failed", { orderId, delayMs, error: lastError.message });
  }

  throw lastError ?? new Error("deliver-order failed");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "No auth" });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json({ ok: false, error: "Invalid auth: " + (userErr?.message ?? "no user") });

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) return json({ ok: false, error: "No tenés permisos de admin" });

    const { order_id } = await req.json();
    if (!order_id) return json({ ok: false, error: "order_id required" });

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, public_code, status, verification_status")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) return json({ ok: false, error: "Pedido no encontrado" });

    if (order.status !== "delivered") {
      await supabase.from("orders").update({
        status: "paid",
        verification_status: "verified",
        verification_notes: "Aprobado manualmente por admin",
      }).eq("id", order_id);

      try {
        await triggerDelivery(order_id);
      } catch (deliveryError) {
        const message = (deliveryError as Error).message;
        await supabase.from("orders").update({
          verification_notes: `Aprobado manualmente por admin. Entrega pendiente: ${message}`,
        }).eq("id", order_id);
        return json({ ok: false, error: message }, 200);
      }
    }

    return json({ ok: true, already_delivered: order.status === "delivered" });
  } catch (e) {
    console.error("approve-order-admin error:", e);
    return json({ ok: false, error: (e as Error).message });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}