import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "No auth" });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return json({ ok: false, error: "Invalid auth" });

    const { order_id } = await req.json();
    if (!order_id) return json({ ok: false, error: "order_id required" });

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, user_id, status")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderErr || !order) return json({ ok: false, error: "Order not found" });

    const response = await fetch(`${SUPABASE_URL}/functions/v1/deliver-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ order_id }),
    });

    const payload = await response.json().catch(() => ({ error: `deliver-order failed (${response.status})` }));
    if (!response.ok) {
      return json({ ok: false, error: payload?.error || `deliver-order failed (${response.status})` });
    }
    return json({ ok: true, ...payload });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message });
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}