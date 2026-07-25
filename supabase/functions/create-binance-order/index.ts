import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildMerchantTradeNo,
  callBinancePay,
  isBinancePayConfigured,
  queryBinanceOrder,
  toBinanceOrderMeta,
} from "../_shared/binancePay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BINANCE_PAY_USDT_RATE_ARS = Number(Deno.env.get("BINANCE_PAY_USDT_RATE_ARS") || "0");

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
  }

  throw lastError ?? new Error("deliver-order failed");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!isBinancePayConfigured()) return json({ error: "Binance Pay is not configured" }, 500);
    if (!BINANCE_PAY_USDT_RATE_ARS || BINANCE_PAY_USDT_RATE_ARS <= 0) {
      return json({ error: "BINANCE_PAY_USDT_RATE_ARS not configured" }, 500);
    }

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
    if (order.payment_method !== "binance") return json({ error: "Order is not Binance" }, 400);

    if (order.verification_status === "verified") {
      if (order.status !== "delivered") {
        try {
          await triggerDelivery(order_id);
        } catch (deliveryError) {
          const message = (deliveryError as Error).message;
          await supabase.from("orders").update({ verification_notes: `Pago Binance confirmado. Entrega pendiente: ${message}` }).eq("id", order_id);
          return json({ status: "PAID", already_verified: true, delivery_failed: true, delivery_error: message });
        }
      }

      return json({ status: "PAID", already_verified: true, order_meta: order.payment_provider_meta ?? null });
    }

    const currentMeta = order.payment_provider_meta as Record<string, unknown> | null;
    if (currentMeta?.provider === "binance_pay" && currentMeta.merchantTradeNo) {
      try {
        const queried = await queryBinanceOrder(String(currentMeta.merchantTradeNo));
        const queriedMeta = toBinanceOrderMeta(queried);
        await supabase.from("orders").update({ payment_provider_meta: queriedMeta }).eq("id", order_id);

        if (queriedMeta.status === "PAID") {
          const { error: paymentUpdateError } = await supabase.from("orders").update({
            status: "paid",
            verification_status: "verified",
            matched_payment_id: queriedMeta.transactionId ?? queriedMeta.prepayId,
            verification_notes: "Pago confirmado por Binance Pay",
            payment_provider_meta: queriedMeta,
          }).eq("id", order_id);
          if (paymentUpdateError) return json({ error: paymentUpdateError.message }, 409);

          try {
            await triggerDelivery(order_id);
          } catch (deliveryError) {
            const message = (deliveryError as Error).message;
            await supabase.from("orders").update({ verification_notes: `Pago confirmado por Binance Pay. Entrega pendiente: ${message}` }).eq("id", order_id);
            return json({ status: "PAID", order_meta: queriedMeta, delivery_failed: true, delivery_error: message });
          }
        }

        if (["INITIAL", "PENDING"].includes(queriedMeta.status) && queriedMeta.expireTime > Date.now() && queriedMeta.checkoutUrl) {
          return json({ status: queriedMeta.status, order_meta: queriedMeta });
        }
      } catch (error) {
        console.error("query Binance order error", error);
      }
    }

    const amountArs = Number(order.exact_amount ?? order.total);
    const amountUsdt = Math.max(amountArs / BINANCE_PAY_USDT_RATE_ARS, 0.000001).toFixed(6);
    const merchantTradeNo = buildMerchantTradeNo(order.id);
    const returnUrl = `${site_url}/checkout/binance/${order.id}?returned=1`;
    const webhookUrl = `${SUPABASE_URL}/functions/v1/binance-pay-webhook`;
    const goodsName = sanitizeGoodsName(order.order_items?.[0]?.product_title || `Pedido ${order.public_code || order.id.slice(0, 8)}`);

    const response = await callBinancePay<{ data: Record<string, unknown> }>("/binancepay/openapi/v2/order", {
      env: { terminalType: "WEB" },
      merchantTradeNo,
      orderAmount: amountUsdt,
      currency: "USDT",
      goods: {
        goodsType: "02",
        goodsCategory: "6000",
        referenceGoodsId: String(order.id).replace(/-/g, ""),
        goodsName,
        goodsDetail: sanitizeGoodsName(`TIBADIGITAL ${order.public_code || order.id.slice(0, 8)}`),
      },
      buyer: {
        buyerEmail: user.email,
      },
      returnUrl,
      cancelUrl: returnUrl,
      orderExpireTime: Date.now() + 1000 * 60 * 30,
      supportPayCurrency: "USDT,USDC,BTC,ETH,BNB,FDUSD",
      passThroughInfo: JSON.stringify({ order_id: order.id, public_code: order.public_code }),
      webhookUrl,
    });

    const orderMeta = toBinanceOrderMeta({
      ...response.data,
      status: "INITIAL",
      orderAmount: amountUsdt,
      currency: "USDT",
      fiatAmount: amountArs.toFixed(2),
      fiatCurrency: "ARS",
      merchantTradeNo,
      passThroughInfo: JSON.stringify({ order_id: order.id, public_code: order.public_code }),
    });

    await supabase.from("orders").update({
      payment_provider_meta: orderMeta,
      verification_notes: "Checkout Binance Pay generado",
    }).eq("id", order_id);

    return json({ status: "INITIAL", order_meta: orderMeta });
  } catch (e) {
    console.error("create-binance-order error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function sanitizeGoodsName(value: string) {
  return value.replace(/[^\p{L}\p{N}\s._-]/gu, "").slice(0, 120).trim() || "Pedido TIBADIGITAL";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
