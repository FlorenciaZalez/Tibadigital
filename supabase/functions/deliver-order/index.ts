// Edge function: entrega las keys de un pedido pagado por email + (opcional) WhatsApp
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
const TWILIO_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM"); // ej: whatsapp:+14155238886

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { order_id } = await req.json();
    if (!order_id) return json({ error: "order_id required" }, 400);

    const { data: order, error: oErr } = await supabase
      .from("orders").select("*, order_items(*)").eq("id", order_id).single();
    if (oErr || !order) return json({ error: "Order not found" }, 404);

    // Email del usuario
    const { data: userData } = await supabase.auth.admin.getUserById(order.user_id);
    const email = userData?.user?.email;
    if (!email) return json({ error: "No email for user" }, 400);

    const { data: profile } = await supabase
      .from("profiles").select("full_name, whatsapp").eq("user_id", order.user_id).single();

    // Reservar y obtener una key disponible por cada item
    const deliveredItems: { title: string; key: any }[] = [];
    for (const item of order.order_items) {
      for (let i = 0; i < item.quantity; i++) {
        const { data: avail } = await supabase
          .from("product_keys")
          .select("*")
          .eq("product_id", item.product_id)
          .eq("status", "available")
          .limit(1)
          .maybeSingle();

        if (avail) {
          await supabase.from("product_keys").update({
            status: "delivered",
            reserved_for_order_id: order_id,
            delivered_to_user_id: order.user_id,
            delivered_at: new Date().toISOString(),
          }).eq("id", avail.id);
          deliveredItems.push({ title: item.product_title, key: avail });
        } else {
          deliveredItems.push({ title: item.product_title, key: null });
        }
      }
    }

    // Construir mensaje
    const itemsHtml = deliveredItems.map(({ title, key }) => {
      if (!key) return `<li><b>${escapeHtml(title)}</b>: ⏳ Sin stock disponible. Te contactamos en breve.</li>`;
      const content = key.key_type === "account"
        ? `<div style="margin-top:8px;white-space:pre-line;background:#171717;border-radius:8px;padding:10px 12px;">👤 ${escapeHtml(key.content)}</div>`
        : `<br/>🎮 <code style="background:#f3f3f3;padding:4px 8px;border-radius:4px;">${escapeHtml(key.content)}</code>`;
      const notes = key.notes ? `<br/><small>${escapeHtml(key.notes)}</small>` : "";
      return `<li><b>${escapeHtml(title)}</b>${content}${notes}</li>`;
    }).join("");

    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#111;border:1px solid #ff00aa;border-radius:12px;padding:30px;">
  <h1 style="color:#ff00aa;font-size:28px;margin:0 0 10px;">¡Pago confirmado! 🎮</h1>
  <p style="color:#00ffff;margin:0 0 20px;">Pedido <b>${order.public_code}</b></p>
  <p>Hola${profile?.full_name ? " " + escapeHtml(profile.full_name) : ""}, recibimos tu pago. Acá están tus juegos:</p>
  <ul style="line-height:1.8;color:#fff;">${itemsHtml}</ul>
  <hr style="border:none;border-top:1px solid #333;margin:20px 0;"/>
  <p style="color:#888;font-size:12px;">Cualquier consulta, respondé este email. ¡Gracias por elegir TIBADIGITAL!</p>
</div></body></html>`;

    const textParts = deliveredItems.map(({ title, key }) =>
      key ? `• ${title}: ${key.content}${key.notes ? " (" + key.notes + ")" : ""}` : `• ${title}: sin stock - te contactamos`
    ).join("\n");
    const text = `¡Pago confirmado! Pedido ${order.public_code}\n\n${textParts}\n\nGracias por elegir TIBADIGITAL.`;

    // Enviar email via Lovable AI Gateway → Resend-compatible (usamos directamente Resend si hubiera, o registramos)
    // Como no hay aún email infra, lo registramos y mandamos por console; queda preparado para Lovable Email
    let emailSent = false;
    let emailError: string | null = null;
    try {
      // Usar Lovable AI Gateway no aplica para email. Por ahora intentamos con Resend si está, sino marcamos pendiente.
      const RESEND = Deno.env.get("RESEND_API_KEY");
      if (RESEND) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "TIBADIGITAL <onboarding@resend.dev>",
            to: [email], subject: `🎮 Tu pedido ${order.public_code} está listo`, html, text,
          }),
        });
        emailSent = r.ok;
        if (!r.ok) emailError = await r.text();
      } else {
        emailError = "Email no configurado (sin RESEND_API_KEY ni Lovable Email).";
        console.log("DELIVERY EMAIL (no provider):", { to: email, text });
      }
    } catch (e) { emailError = (e as Error).message; }

    // Enviar WhatsApp via Twilio si está configurado y el cliente cargó número
    let waSent = false;
    let waError: string | null = null;
    const phone = order.whatsapp || profile?.whatsapp;
    if (phone && TWILIO_API_KEY && TWILIO_FROM) {
      try {
        const r = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: `whatsapp:${phone.startsWith("+") ? phone : "+" + phone}`,
            From: TWILIO_FROM,
            Body: text,
          }),
        });
        waSent = r.ok;
        if (!r.ok) waError = await r.text();
      } catch (e) { waError = (e as Error).message; }
    }

    await supabase.from("orders").update({
      status: "delivered",
      verification_notes: `Entregado. Email: ${emailSent ? "OK" : "FAIL " + emailError} · WhatsApp: ${waSent ? "OK" : phone ? "FAIL " + waError : "no number"}`,
    }).eq("id", order_id);

    return json({ delivered: true, email_sent: emailSent, whatsapp_sent: waSent });
  } catch (e) {
    console.error("deliver-order error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function escapeHtml(s: string) { return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
function escapeAttr(s: string) { return escapeHtml(s); }
