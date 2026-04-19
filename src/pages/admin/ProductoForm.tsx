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
import { embedAccountTierInGenre, embedPlatformInGenre, getLegacyCompatiblePlatform, inferAccountTier, inferPlatform, isInvalidCombinedPlatformError, isMissingAccountTierColumnError, stripAccountTierFromGenre, type AccountTier, type PlatformVariant } from "@/lib/productVariants";
import { toast } from "sonner";

const PLATFORMS = ["PS5", "PS4", "PS4/PS5"];
const ACCOUNT_TIERS = [
  { value: "primary", label: "Primaria" },
  { value: "secondary", label: "Secundaria" },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const buildProductSlug = (title: string, platform: string, accountTier: string) =>
  slugify([title, platform, accountTier].filter(Boolean).join(" "));

/** Redondea al $100 más cercano: $1160→$1200, $1140→$1100 */
const roundTo100 = (n: number) => Math.round(n / 100) * 100;

const computeFinalPrice = (resellerPrice: string, markupPct: string): string => {
  const base = parseFloat(resellerPrice);
  const pct = parseFloat(markupPct);
  if (!base || isNaN(base) || !pct || isNaN(pct)) return "";
  return String(roundTo100(base * (1 + pct / 100)));
};

const ProductoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === "nuevo";
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", slug: "", description: "", price: "", discount_price: "", reseller_price: "",
    markup_pct: "",
    stock: "1", platform: "PS5", account_tier: "primary", genre: "", cover_url: "",
    release_year: "", featured: false, is_active: true,
  });

  useEffect(() => {
    document.title = isNew ? "Nuevo producto | Admin" : "Editar producto | Admin";
    if (isNew) return;
    supabase.from("products").select("*").eq("id", id!).maybeSingle().then(({ data }) => {
      if (data) {
        const resellerStr = data.reseller_price ? String(data.reseller_price) : "";
        const priceStr = String(data.price);
        let markupPct = "";
        if (data.reseller_price && data.reseller_price > 0 && data.price > 0) {
          markupPct = String(Math.round(((data.price / data.reseller_price) - 1) * 100));
        }
        setForm({
        title: data.title,
        slug: data.slug,
        description: data.description ?? "",
        price: priceStr,
        discount_price: data.discount_price ? String(data.discount_price) : "",
        reseller_price: resellerStr,
        markup_pct: markupPct,
        stock: String(data.stock),
        platform: inferPlatform(data),
        account_tier: inferAccountTier(data),
        genre: stripAccountTierFromGenre(data.genre),
        cover_url: data.cover_url ?? "",
        release_year: data.release_year ? String(data.release_year) : "",
        featured: data.featured,
        is_active: data.is_active,
      });
      }
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
    if (!form.reseller_price || !Number(form.reseller_price)) {
      toast.error("El precio de revendedor es obligatorio");
      return;
    }
    if (!form.price || !Number(form.price)) {
      toast.error("Ingresá el porcentaje para calcular el precio final");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      slug: buildProductSlug(form.title, form.platform, form.account_tier),
      description: form.description || null,
      price: Number(form.price),
      discount_price: form.discount_price ? Number(form.discount_price) : null,
      reseller_price: form.reseller_price ? Number(form.reseller_price) : null,
      stock: parseInt(form.stock) || 0,
      platform: form.platform as any,
      account_tier: form.account_tier as any,
      genre: stripAccountTierFromGenre(form.genre) || null,
      cover_url: form.cover_url || null,
      release_year: form.release_year ? parseInt(form.release_year) : null,
      featured: form.featured,
      is_active: form.is_active,
    };

    let { error } = isNew
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", id!);

    if (isMissingAccountTierColumnError(error) || isInvalidCombinedPlatformError(error)) {
      const legacyPayload = {
        ...payload,
        platform: getLegacyCompatiblePlatform(form.platform as PlatformVariant),
        genre: embedAccountTierInGenre(embedPlatformInGenre(form.genre, form.platform as PlatformVariant), form.account_tier as AccountTier),
      } as typeof payload & { account_tier?: never };

      delete (legacyPayload as { account_tier?: AccountTier }).account_tier;

      ({ error } = isNew
        ? await supabase.from("products").insert(legacyPayload)
        : await supabase.from("products").update(legacyPayload).eq("id", id!));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Ya existe un producto con esa combinacion de titulo, plataforma y tipo" : `Error al guardar: ${error.message}`);
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
            <p className="text-xs text-muted-foreground mt-1">Slug final: {buildProductSlug(form.title || "nuevo-producto", form.platform, form.account_tier)}</p>
          </div>
          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-input mt-1" rows={5} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="platform">Plataforma *</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger className="bg-input mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="account_tier">Tipo de cuenta *</Label>
              <Select value={form.account_tier} onValueChange={(v) => setForm({ ...form, account_tier: v })}>
                <SelectTrigger className="bg-input mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ACCOUNT_TIERS.map((tier) => <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>)}</SelectContent>
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
          <p className="text-xs text-muted-foreground">Creá una publicación por combinación. Ejemplos: FC 26 + PS5 + Primaria, FC 26 + PS5 + Secundaria, FC 26 + PS4 + Primaria.</p>
        </div>

        {/* Pricing */}
        <div className="card-cyber p-6 rounded-xl space-y-4">
          <h2 className="font-display font-bold text-base uppercase tracking-wider">Precio y stock</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reseller_price">Precio revendedor (ARS) *</Label>
              <Input id="reseller_price" type="number" step="1" required value={form.reseller_price} onChange={(e) => {
                const newReseller = e.target.value;
                const newPrice = computeFinalPrice(newReseller, form.markup_pct);
                setForm({ ...form, reseller_price: newReseller, price: newPrice || form.price });
              }} className="bg-input mt-1" />
            </div>
            <div>
              <Label htmlFor="markup_pct">Porcentaje cliente final (%)</Label>
              <Input id="markup_pct" type="number" step="1" value={form.markup_pct} onChange={(e) => {
                const newPct = e.target.value;
                const newPrice = computeFinalPrice(form.reseller_price, newPct);
                setForm({ ...form, markup_pct: newPct, price: newPrice || form.price });
              }} className="bg-input mt-1" placeholder="Ej: 16" />
              <p className="text-xs text-muted-foreground mt-1">Precio final = revendedor + %  (redondeado a $100)</p>
            </div>
            <div>
              <Label htmlFor="price">Precio cliente final (ARS)</Label>
              <Input id="price" type="number" step="1" value={form.price} readOnly className="bg-input mt-1 opacity-70" />
              {form.reseller_price && form.markup_pct && form.price && (
                <p className="text-xs text-primary mt-1">
                  ${form.reseller_price} + {form.markup_pct}% = ${form.price}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="discount_price">Precio oferta cliente (ARS)</Label>
              <Input id="discount_price" type="number" step="1" value={form.discount_price} onChange={(e) => setForm({ ...form, discount_price: e.target.value })} className="bg-input mt-1" />
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
              <Label htmlFor="featured" className="text-base">Oferta</Label>
              <p className="text-xs text-muted-foreground">Aparece en la categoría Ofertas</p>
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
