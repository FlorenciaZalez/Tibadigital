import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("checkout and fulfillment security contracts", () => {
  it("calculates checkout prices in the database instead of trusting the browser", () => {
    const migration = read("supabase/migrations/20260724190000_secure_checkout_and_fulfillment.sql");
    const checkout = read("src/pages/Checkout.tsx");

    expect(migration).toContain("COALESCE(p.discount_price, p.price)");
    expect(migration).toContain("lower(auth.jwt() ->> 'email')");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_checkout_order");
    expect(checkout).toContain('supabase.rpc("create_checkout_order"');
    expect(checkout).not.toContain('.from("orders").insert');
  });

  it("requires a verified paid order and claims stock transactionally", () => {
    const migration = read("supabase/migrations/20260724190000_secure_checkout_and_fulfillment.sql");
    const delivery = read("supabase/functions/deliver-order/index.ts");

    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("_order.status <> 'paid'");
    expect(migration).toContain("_order.verification_status <> 'verified'");
    expect(delivery).toContain('return json({ error: "Order is not paid" }, 409)');
    expect(delivery).toContain('supabase.rpc("claim_paid_order_keys"');
  });

  it("does not mark fulfillment delivered when email or Sheets failed", () => {
    const delivery = read("supabase/functions/deliver-order/index.ts");

    expect(delivery).toContain('status: fulfilled ? "delivered" : "paid"');
    expect(delivery).toContain("fulfillment_error: fulfilled ? null");
    expect(delivery).toContain("if (!fulfilled)");
    expect(delivery).toContain('"Idempotency-Key": `delivery-${order_id}`');
  });

  it("supports server-to-server Mercado Pago completion", () => {
    const preference = read("supabase/functions/create-mercadopago-preference/index.ts");
    const webhook = read("supabase/functions/mercadopago-webhook/index.ts");

    expect(preference).toContain("notification_url");
    expect(webhook).toContain("payment.external_reference");
    expect(webhook).toContain('status: "paid"');
    expect(webhook).toContain("deliver-order");
  });
});
