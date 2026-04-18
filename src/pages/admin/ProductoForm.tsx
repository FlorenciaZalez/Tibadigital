import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ChevronLeft, Save, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PLATFORMS = ["PS5", "PS4"];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const ProductoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === "nuevo";
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", slug: "", description: "", price: "", discount_price: "", reseller_price: "",
    stock: "1", platform: "PS5", genre: "", cover_url: "",
    release_year: "", featured: false, is_active: true,
  });

  useEffect(() => {
    document.title = isNew ? "Nuevo producto | Admin" : "Editar producto | Admin";
    if (isNew) return;
    supabase.from("products").select("*").eq("id", id!).maybeSingle().then(({ data }) => {
      if (data) setForm({
        title: data.title,
        slug: data.slug,
        description: data.description ?? "",
        price: String(data.price),
        discount_price: data.discount_price ? String(data.discount_price) : "",
        reseller_price: data.reseller_price ? String(data.reseller_price) : "",
        stock: String(data.stock),
        platform: data.platform,
        genre: data.genre ?? "",
        cover_url: data.cover_url ?? "",
        release_year: data.release_year ? String(data.release_year) : "",
        featured: data.featured,
        is_active: data.is_active,
      });
    });
  }, [id, isNew]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast.error("Error al subir imagen"); setUploading(false); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm({ ...form, cover_url: data.publicUrl });
    toast.success("Imagen subida");
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      slug: slugify(form.title),
      description: form.description || null,
      price: Number(form.price),
      discount_price: form.discount_price ? Number(form.discount_price) : null,
      reseller_price: form.reseller_price ? Number(form.reseller_price) : null,
      stock: parseInt(form.stock) || 0,
      platform: form.platform as any,
      genre: form.genre || null,
      cover_url: form.cover_url || null,
      release_year: form.release_year ? parseInt(form.release_year) : null,
      featured: form.featured,
      is_active: form.is_active,
    };

    const { error } = isNew
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", id!);

    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Ya existe un producto con ese slug" : "Error al guardar");
    } else {
      toast.success(isNew ? "Producto creado" : "Producto actualizado");
      navigate("/admin");
    }
  };

  return (
    <div className="container py-10 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/admin"><ChevronLeft />Volver al admin</Link>
      </Button>

      <h1 className="font-display font-black text-3xl md:text-4xl mb-8">
        {isNew ? "NUEVO" : "EDITAR"} <span className="text-gradient-neon">PRODUCTO</span>
      </h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Cover */}
        <div className="card-cyber p-6 rounded-xl space-y-3">
          <Label>Imagen de portada</Label>
          <div className="flex items-start gap-4">
            <div className="w-32 h-44 rounded-lg overflow-hidden bg-muted flex items-center justify-center border border-border shrink-0">
              {form.cover_url ? (
                <img src={form.cover_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground opacity-50" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/*"
                id="cover-upload"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
              <Button type="button" variant="neon" disabled={uploading} onClick={() => document.getElementById("cover-upload")?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
                {uploading ? "Subiendo..." : "Subir imagen"}
              </Button>
              {form.cover_url && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, cover_url: "" })}>
                  <X className="h-3 w-3" />Quitar
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Formato vertical recomendado (3:4)</p>
            </div>
          </div>
        </div>

        {/* Main info */}
        <div className="card-cyber p-6 rounded-xl space-y-4">
          <h2 className="font-display font-bold text-base uppercase tracking-wider">Información</h2>
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-input mt-1" />
          </div>
          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-input mt-1" rows={5} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="platform">Plataforma *</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger className="bg-input mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="genre">Género</Label>
              <Input id="genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} className="bg-input mt-1" placeholder="Acción, RPG..." />
            </div>
            <div>
              <Label htmlFor="release_year">Año</Label>
              <Input id="release_year" type="number" value={form.release_year} onChange={(e) => setForm({ ...form, release_year: e.target.value })} className="bg-input mt-1" />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card-cyber p-6 rounded-xl space-y-4">
          <h2 className="font-display font-bold text-base uppercase tracking-wider">Precio y stock</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Precio cliente final (ARS) *</Label>
              <Input id="price" type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-input mt-1" />
            </div>
            <div>
              <Label htmlFor="discount_price">Precio oferta cliente (ARS)</Label>
              <Input id="discount_price" type="number" step="0.01" value={form.discount_price} onChange={(e) => setForm({ ...form, discount_price: e.target.value })} className="bg-input mt-1" />
            </div>
            <div>
              <Label htmlFor="reseller_price">Precio revendedor (ARS)</Label>
              <Input id="reseller_price" type="number" step="0.01" value={form.reseller_price} onChange={(e) => setForm({ ...form, reseller_price: e.target.value })} className="bg-input mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Si está vacío, revendedores ven el precio base</p>
            </div>
            <div>
              <Label htmlFor="stock">Stock *</Label>
              <Input id="stock" type="number" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="bg-input mt-1" />
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="card-cyber p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="featured" className="text-base">Destacado</Label>
              <p className="text-xs text-muted-foreground">Aparece en el home</p>
            </div>
            <Switch id="featured" checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_active" className="text-base">Activo</Label>
              <p className="text-xs text-muted-foreground">Visible en el catálogo</p>
            </div>
            <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" variant="hero" size="lg" disabled={saving}>
            <Save />{saving ? "Guardando..." : "Guardar producto"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/admin")}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
};

export default ProductoForm;
