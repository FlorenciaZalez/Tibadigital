import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User, Package, Shield, LogOut, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { COUNTRY_OPTIONS, normalizeCountry } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Cuenta = () => {
  const { user, isAdmin, signOut } = useAuth();
  const [profile, setProfile] = useState({ username: "", full_name: "", phone: "", address: "", city: "", country: "AR" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Mi cuenta | TIBADIGITAL";
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile({
        username: data.username ?? "",
        full_name: data.full_name ?? "",
        phone: data.phone ?? "",
        address: data.address ?? "",
        city: data.city ?? "",
        country: normalizeCountry(data.country),
      });
      setLoading(false);
    });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(profile).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Error al guardar");
    else toast.success("Perfil actualizado");
  };

  if (loading) return <div className="container py-20 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="container py-12 max-w-5xl">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display mb-2">// Mi cuenta</div>
          <h1 className="font-display font-black text-3xl md:text-5xl">
            HOLA, <span className="text-gradient-neon">{profile.username || "GAMER"}</span>
          </h1>
        </div>
        <Button variant="ghost" onClick={signOut}><LogOut />Cerrar sesión</Button>
      </div>

      <div className={`grid grid-cols-1 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4 mb-8 items-stretch`}>
        <Link to="/cuenta" className="card-cyber w-full min-h-[104px] p-5 rounded-xl flex items-center gap-3 group justify-start">
          <div className="w-10 h-10 rounded-md bg-primary/20 text-primary flex items-center justify-center"><User className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-bold text-sm uppercase tracking-wide">Perfil</div>
            <div className="text-xs text-muted-foreground">Editar datos</div>
          </div>
        </Link>
        <Link to="/cuenta/pedidos" className="card-cyber w-full min-h-[104px] p-5 rounded-xl flex items-center gap-3 group justify-start">
          <div className="w-10 h-10 rounded-md bg-secondary/20 text-secondary flex items-center justify-center"><Package className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-bold text-sm uppercase tracking-wide">Pedidos</div>
            <div className="text-xs text-muted-foreground">Mis compras</div>
          </div>
        </Link>
        {isAdmin && (
          <Link to="/admin" className="card-cyber w-full min-h-[104px] p-5 rounded-xl flex items-center gap-3 group justify-start hover:border-secondary">
            <div className="w-10 h-10 rounded-md bg-gradient-cyber flex items-center justify-center text-white"><Shield className="h-5 w-5" /></div>
            <div>
              <div className="font-display font-bold text-sm uppercase tracking-wide">Admin</div>
              <div className="text-xs text-muted-foreground">Panel de control</div>
            </div>
          </Link>
        )}
      </div>

      <form onSubmit={handleSave} className="card-cyber rounded-2xl p-6 md:p-8 space-y-5">
        <h2 className="font-display font-bold text-xl uppercase tracking-wider">Mis datos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted mt-1" />
          </div>
          <div>
            <Label htmlFor="username">Usuario</Label>
            <Input id="username" value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input id="full_name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="bg-input mt-1" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label htmlFor="country">País</Label>
            <Select value={profile.country || "AR"} onValueChange={(value) => setProfile({ ...profile, country: value })}>
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
        </div>
        <Button type="submit" variant="hero" disabled={saving}>
          <Save />{saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
    </div>
  );
};

export default Cuenta;
