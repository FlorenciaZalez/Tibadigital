import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_OPTIONS } from "@/lib/currency";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const normalizePassword = (email: string, password: string) => {
  const cleanEmail = email.trim().toLowerCase();
  return `${password}::${cleanEmail}::tibadigital`;
};

const mapAuthError = (message: string) => {
  const lower = message.toLowerCase();

  if (lower.includes("already registered")) return "Este email ya está registrado";
  if (lower.includes("invalid")) return "Email o contraseña incorrectos";
  if (lower.includes("weak") || lower.includes("easy to guess")) {
    return "No se pudo registrar esa contraseña. Probá nuevamente.";
  }

  return message;
};

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signupForm, setSignupForm] = useState({ email: "", password: "", username: "", full_name: "", country: "AR", user_type: "client" as "client" | "reseller", reseller_code: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // If reseller, validate code first
    if (signupForm.user_type === "reseller") {
      const { data: codeRow, error: codeErr } = await supabase
        .from("reseller_codes")
        .select("id")
        .eq("code", signupForm.reseller_code.trim())
        .is("used_by", null)
        .maybeSingle();

      if (codeErr || !codeRow) {
        toast.error("Código de revendedor inválido o ya utilizado");
        setLoading(false);
        return;
      }
    }

    const redirectUrl = `${window.location.origin}/`;
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: signupForm.email,
      password: normalizePassword(signupForm.email, signupForm.password),
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username: signupForm.username,
          full_name: signupForm.full_name,
          country: signupForm.country,
          user_type: signupForm.user_type,
        },
      },
    });
    
    // If reseller signup succeeded, mark code as used
    if (!error && signUpData.user && signupForm.user_type === "reseller") {
      await supabase
        .from("reseller_codes")
        .update({ used_by: signUpData.user.id, used_at: new Date().toISOString() })
        .eq("code", signupForm.reseller_code.trim())
        .is("used_by", null);
    }

    setLoading(false);
    if (error) {
      toast.error(mapAuthError(error.message));
    } else {
      toast.success("¡Cuenta creada!", { description: "Revisá tu email para confirmar tu cuenta." });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });

    if (error) {
      const retry = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: normalizePassword(loginForm.email, loginForm.password),
      });
      error = retry.error;
    }

    setLoading(false);
    if (error) {
      toast.error(mapAuthError(error.message));
    } else {
      toast.success("¡Bienvenido de vuelta!");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-glow-pulse" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-secondary/30 rounded-full blur-3xl animate-glow-pulse" />

      <div className="relative w-full max-w-md space-y-6 animate-fade-in-up">
        <div className="text-center space-y-3">
          <div className="flex justify-center"><Link to="/"><img src="/logoredondo.png" alt="TIBADIGITAL" className="h-40 w-40" /></Link></div>
          <p className="text-muted-foreground text-sm">Accedé a tu cuenta gamer</p>
        </div>

        <div className="card-cyber rounded-2xl p-6 md:p-8">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted">
              <TabsTrigger value="login" className="data-[state=active]:bg-gradient-cyber data-[state=active]:text-white">Ingresar</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-cyber data-[state=active]:text-white">Registrarme</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" required value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} className="bg-input mt-1" placeholder="tu@email.com" />
                </div>
                <div>
                  <Label htmlFor="login-pwd">Contraseña</Label>
                  <Input id="login-pwd" type="password" required value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} className="bg-input mt-1" placeholder="••••••••" />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : "Ingresar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                {/* User type selection */}
                <div>
                  <Label>Tipo de cuenta</Label>
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setSignupForm({ ...signupForm, user_type: "client", reseller_code: "" })}
                      className={`py-3 px-4 rounded-lg border text-sm font-semibold transition-all ${signupForm.user_type === "client" ? "border-primary bg-primary/20 text-primary" : "border-border bg-input text-muted-foreground hover:border-primary/50"}`}
                    >
                      🎮 Cliente final
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignupForm({ ...signupForm, user_type: "reseller" })}
                      className={`py-3 px-4 rounded-lg border text-sm font-semibold transition-all ${signupForm.user_type === "reseller" ? "border-secondary bg-secondary/20 text-secondary" : "border-border bg-input text-muted-foreground hover:border-secondary/50"}`}
                    >
                      🏪 Revendedor
                    </button>
                  </div>
                </div>

                {signupForm.user_type === "reseller" && (
                  <div>
                    <Label htmlFor="reseller-code">Código de revendedor *</Label>
                    <Input id="reseller-code" required value={signupForm.reseller_code} onChange={(e) => setSignupForm({ ...signupForm, reseller_code: e.target.value })} className="bg-input mt-1" placeholder="Ingresá tu código" />
                    <p className="text-xs text-muted-foreground mt-1">Necesitás un código válido para registrarte como revendedor</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="signup-username">Usuario</Label>
                    <Input id="signup-username" required value={signupForm.username} onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })} className="bg-input mt-1" placeholder="gamer123" />
                  </div>
                  <div>
                    <Label htmlFor="signup-name">Nombre</Label>
                    <Input id="signup-name" value={signupForm.full_name} onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })} className="bg-input mt-1" placeholder="Tu nombre" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" required value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} className="bg-input mt-1" placeholder="tu@email.com" />
                </div>
                <div>
                  <Label htmlFor="signup-country">País</Label>
                  <Select value={signupForm.country} onValueChange={(value) => setSignupForm({ ...signupForm, country: value })}>
                    <SelectTrigger className="bg-input mt-1">
                      <SelectValue placeholder="Seleccioná tu país" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="signup-pwd">Contraseña</Label>
                  <Input id="signup-pwd" type="password" required minLength={6} value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} className="bg-input mt-1" placeholder="Mínimo 6 caracteres" />
                </div>
                <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : "Crear cuenta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Al registrarte aceptás nuestros{" "}
          <Link to="#" className="text-secondary hover:underline">términos y condiciones</Link>
        </p>
      </div>
    </div>
  );
};

export default Auth;
