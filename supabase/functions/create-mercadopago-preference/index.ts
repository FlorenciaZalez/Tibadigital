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

    const { order_id, site_url } = await req.json();
    if (!order_id || !site_url) return json({ error: "order_id and site_url required" }, 400);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderErr || !order) return json({ error: "Order not found" }, 404);
    if (order.payment_method !== "mercadopago") return json({ error: "Order is not Mercado Pago" }, 400);

    const successUrl = `${site_url}/checkout/mercadopago/resultado?order_id=${order.id}`;
    const isLocalSite = /localhost|127\.0\.0\.1/.test(site_url);

    const payload: Record<string, unknown> = {
      items: (order.order_items || []).map((item: any) => ({
        id: item.product_id,
        title: item.product_title,
        quantity: item.quantity,
        currency_id: "ARS",
        unit_price: Number(item.unit_price),
      })),
      payer: {
        email: user.email,
      },
      external_reference: order.id,
      statement_descriptor: "TIBADIGITAL",
      back_urls: {
        success: successUrl,
        pending: successUrl,
        failure: successUrl,
      },
      metadata: {
        order_id: order.id,
        public_code: order.public_code,
      },
    };

    if (!isLocalSite) {
      payload.auto_return = "approved";
    }

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.error("create preference error:", mpData);
      return json({ error: "Mercado Pago preference failed", detail: mpData }, 500);
    }

    return json({
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    });
  } catch (e) {
    console.error("create-mercadopago-preference error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}