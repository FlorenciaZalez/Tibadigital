import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CODE_SERVICE_URL = (Deno.env.get("CODE_SERVICE_URL") || "").replace(/\/+$/, "");
const CODE_SERVICE_API_KEY = Deno.env.get("CODE_SERVICE_API_KEY") || "";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const callCodeService = async (action: "validate" | "claim", body: Record<string, string>) => {
  if (!CODE_SERVICE_URL || !CODE_SERVICE_API_KEY) {
    throw new Error("La validación de revendedores no está configurada.");
  }

  const response = await fetch(`${CODE_SERVICE_URL}/api/v1/tibadigital/resellers/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CODE_SERVICE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let createdUserId: string | null = null;
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const resellerCode = String(body.reseller_code || "").trim().toUpperCase();
    const redirectTo = String(body.redirect_to || "").trim();
    const username = String(body.username || "").trim();
    const fullName = String(body.full_name || "").trim();
    const country = String(body.country || "AR").trim().toUpperCase();

    if (!email || !password || !resellerCode || !redirectTo || !username) {
      return json({ error: "Faltan datos obligatorios para crear la cuenta." }, 400);
    }
    if (!resellerCode.startsWith("RV")) {
      return json({ error: "Ingresá el código RV asignado en la web de códigos." }, 400);
    }

    const validation = await callCodeService("validate", { code: resellerCode, email });
    if (!validation.ok) {
      return json({
        error: String(validation.payload?.error || "Código RV inválido o ya utilizado."),
      }, validation.status >= 500 ? 502 : validation.status);
    }

    const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signUpData, error: signUpError } = await publicClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          username,
          full_name: fullName,
          country,
          user_type: "reseller",
          reseller_code: resellerCode,
        },
      },
    });

    if (signUpError || !signUpData.user || signUpData.user.identities?.length === 0) {
      return json({
        error: signUpError?.message || "Este email ya está registrado.",
      }, 400);
    }
    createdUserId = signUpData.user.id;

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: membershipError } = await adminClient.from("reseller_accounts").insert({
      user_id: createdUserId,
      client_code: resellerCode,
      email,
    });
    if (membershipError) throw membershipError;

    const claim = await callCodeService("claim", {
      code: resellerCode,
      email,
      user_id: createdUserId,
    });
    if (!claim.ok) {
      throw new Error(String(claim.payload?.error || "No se pudo reservar el código RV."));
    }

    return json({ success: true });
  } catch (error) {
    if (createdUserId) {
      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await adminClient.auth.admin.deleteUser(createdUserId);
    }
    return json({ error: (error as Error).message || "No se pudo crear la cuenta." }, 500);
  }
});
