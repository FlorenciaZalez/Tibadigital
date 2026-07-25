import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ChevronLeft, Save, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { computeFinalPrice as computeRoundedFinalPrice, getStoredGlobalMarkupPct } from "@/lib/pricing";
import { embedAccountTierInGenre, embedPlatformInGenre, getLegacyCompatiblePlatform, inferAccountTier, inferPlatform, isInvalidCombinedPlatformError, isMissingAccountTierColumnError, isMissingPreventaColumnError, stripAccountTierFromGenre, type AccountTier, type PlatformVariant } from "@/lib/productVariants";
import { toast } from "sonner";

const PLATFORMS = ["PS5", "PS4", "PS4/PS5"];
const ACCOUNT_TIERS = [
  { value: "primary", label: "Primaria" },
  { value: "secondary", label: "Secundaria" },
  { value: "plus", label: "Plus" },
];

type SaleTier = "primary" | "secondary";
type SalePlatform = "PS4" | "PS5" | "PS4/PS5";
type VariantKey = "PS4_primary" | "PS5_primary" | "PS4PS5_secondary";
type VariantDraft = { enabled: boolean; reseller_price: string; price: string; stock: string };

const SALE_VARIANTS: Array<{ key: VariantKey; platform: SalePlatform; tier: SaleTier; label: string }> = [
  { key: "PS4_primary", platform: "PS4", tier: "primary", label: "PS4 · Primaria" },
  { key: "PS5_primary", platform: "PS5", tier: "primary", label: "PS5 · Primaria" },
  { key: "PS4PS5_secondary", platform: "PS4/PS5", tier: "secondary", label: "PS4/PS5 · Secundaria" },
];

const initialVariants = (): Record<VariantKey, VariantDraft> => ({
  PS4_primary: { enabled: false, reseller_price: "", price: "", stock: "1" },
  PS5_primary: { enabled: true, reseller_price: "", price: "", stock: "1" },
  PS4PS5_secondary: { enabled: false, reseller_price: "", price: "", stock: "1" },
});

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const buildProductSlug = (title: string, platform: string, accountTier: string) =>
  slugify([title, platform, accountTier].filter(Boolean).join(" "));

const computeFinalPrice = (resellerPrice: string, markupPct: string): string => {
  const base = parseFloat(resellerPrice);
  const pct = parseFloat(markupPct);
  const computedPrice = computeRoundedFinalPrice(base, pct);
  return computedPrice > 0 ? String(computedPrice) : "";
};

const ProductoForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = id === "nuevo";
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [globalMarkupPct, setGlobalMarkupPct] = useState(getStoredGlobalMarkupPct());
  const [discountPriceEnabled, setDiscountPriceEnabled] = useState(false);
  const [variants, setVariants] = useState(initialVariants);
  const [isPlusProduct, setIsPlusProduct] = useState(false);
  const [form, setForm] = useState({
    title: "", slug: "", description: "", price: "", discount_price: "", reseller_price: "",
    stock: "1", platform: "PS5", account_tier: "primary", genre: "", cover_url: "",
    release_year: "", featured: false, is_estreno: false, is_preventa: false, is_ps_plus: false, is_active: true,
  });

  useEffect(() => {
    const syncGlobalMarkup = () => {
      const nextGlobalMarkupPct = getStoredGlobalMarkupPct();
      setGlobalMarkupPct(nextGlobalMarkupPct);
      setForm((current) => ({
        ...current,
        price: computeFinalPrice(current.reseller_price, String(nextGlobalMarkupPct)) || current.price,
      }));
      setVariants((current) => Object.fromEntries(Object.entries(current).map(([key, variant]) => [
        key,
        { ...variant, price: computeFinalPrice(variant.reseller_price, String(nextGlobalMarkupPct)) || variant.price },
      ])) as Record<VariantKey, VariantDraft>);
    };

    window.addEventListener("global-markup-updated", syncGlobalMarkup);
    return () => window.removeEventListener("global-markup-updated", syncGlobalMarkup);
  }, []);

  useEffect(() => {
    document.title = isNew ? "Nuevo producto | Admin" : "Editar producto | Admin";
    if (isNew) return;
    supabase.from("products").select("*").eq("id", id!).maybeSingle().then(({ data }) => {
      if (data) {
        const resellerStr = data.reseller_price ? String(data.reseller_price) : "";
        const priceStr = String(data.price);
        setDiscountPriceEnabled(data.discount_price != null);
        setForm({
        title: data.title,
        slug: data.slug,
        description: data.description ?? "",
        price: computeFinalPrice(resellerStr, String(globalMarkupPct)) || priceStr,
        discount_price: data.discount_price ? String(data.discount_price) : "",
        reseller_price: resellerStr,
        stock: String(data.stock),
        platform: inferPlatform(data),
        account_tier: inferAccountTier(data),
        genre: stripAccountTierFromGenre(data.genre),
        cover_url: data.cover_url ?? "",
        release_year: data.release_year ? String(data.release_year) : "",
        featured: data.featured,
        is_estreno: data.is_estreno ?? false,
        is_preventa: data.is_preventa ?? false,
        is_ps_plus: inferAccountTier(data) === "plus" || data.is_ps_plus === true,
        is_active: data.is_active,
      });
      }
    });
  }, [globalMarkupPct, id, isNew]);

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
    if (isNew) {
      const availableVariants = isPlusProduct
        ? SALE_VARIANTS.filter(({ tier }) => tier === "primary")
        : SALE_VARIANTS;
      const enabledVariants = availableVariants.filter(({ key }) => variants[key].enabled);
      if (enabledVariants.length === 0) {
        toast.error("Seleccioná al menos una combinación de consola y tipo de cuenta");
        return;
      }
      const invalidVariant = enabledVariants.find(({ key }) =>
        !Number(variants[key].reseller_price) || !Number(variants[key].price)
      );
      if (invalidVariant) {
        toast.error(`Completá un precio válido para ${invalidVariant.label}`);
        return;
      }

      setSaving(true);
      const payloads = enabledVariants.map(({ key, platform, tier }) => ({
        title: form.title,
        slug: buildProductSlug(form.title, platform, isPlusProduct ? "plus" : tier),
        description: form.description || null,
        price: Number(variants[key].price),
        discount_price: null,
        reseller_price: Number(variants[key].reseller_price),
        stock: parseInt(variants[key].stock) || 0,
        platform,
        account_tier: isPlusProduct ? "plus" as const : tier,
        genre: stripAccountTierFromGenre(form.genre) || null,
        cover_url: form.cover_url || null,
        release_year: form.release_year ? parseInt(form.release_year) : null,
        featured: form.featured,
        is_estreno: form.is_estreno,
        is_preventa: form.is_preventa,
        is_ps_plus: isPlusProduct,
        is_active: form.is_active,
      }));
      const { error } = await supabase.from("products").insert(payloads);
      setSaving(false);
      if (error) {
        toast.error(error.message.includes("duplicate")
          ? "Ya existe alguna de las combinaciones seleccionadas"
          : `Error al guardar: ${error.message}`);
      } else {
        toast.success(`${payloads.length} variante${payloads.length === 1 ? "" : "s"} creada${payloads.length === 1 ? "" : "s"}`);
        navigate("/admin");
      }
      return;
    }

    if (!form.reseller_price || !Number(form.reseller_price)) {
      toast.error("El precio de revendedor es obligatorio");
      return;
    }
    if (!form.price || !Number(form.price)) {
      toast.error("Definí un precio revendedor válido para calcular el precio final");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      slug: buildProductSlug(form.title, form.platform, form.account_tier),
      description: form.description || null,
      price: Number(form.price),
      discount_price: discountPriceEnabled && form.discount_price ? Number(form.discount_price) : null,
      reseller_price: form.reseller_price ? Number(form.reseller_price) : null,
      stock: parseInt(form.stock) || 0,
      platform: form.platform as any,
      account_tier: form.account_tier as any,
      genre: stripAccountTierFromGenre(form.genre) || null,
      cover_url: form.cover_url || null,
      release_year: form.release_year ? parseInt(form.release_year) : null,
      featured: form.featured,
      is_estreno: form.is_estreno,
      is_preventa: form.is_preventa,
      is_ps_plus: form.account_tier === "plus",
      is_active: form.is_active,
    };

    let { error } = isNew
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", id!);

    if (isMissingAccountTierColumnError(error) || isInvalidCombinedPlatformError(error) || isMissingPreventaColumnError(error)) {
      const legacyPayload = {
        ...payload,
        platform: getLegacyCompatiblePlatform(form.platform as PlatformVariant),
        genre: embedAccountTierInGenre(embedPlatformInGenre(form.genre, form.platform as PlatformVariant), form.account_tier as AccountTier),
      } as typeof payload & { account_tier?: never; is_preventa?: never };

      delete (legacyPayload as { account_tier?: AccountTier }).account_tier;
      delete (legacyPayload as { is_preventa?: boolean }).is_preventa;

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
    <div className="container py-10 max-w-5xl">
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
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isNew ? "lg:grid-cols-2" : "lg:grid-cols-4"} gap-4`}>
            {!isNew && (
              <>
            <div>
              <Label htmlFor="platform">Plataforma *</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger className="bg-input mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="account_tier">Tipo de cuenta *</Label>
              <Select value={form.account_tier} onValueChange={(v) => setForm({ ...form, account_tier: v, is_ps_plus: v === "plus" })}>
                <SelectTrigger className="bg-input mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{ACCOUNT_TIERS.map((tier) => <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
              </>
            )}
            <div>
              <Label htmlFor="genre">Género</Label>
              <Input id="genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} className="bg-input mt-1" placeholder="Acción, RPG..." />
            </div>
            <div>
              <Label htmlFor="release_year">Año</Label>
              <Input id="release_year" type="number" value={form.release_year} onChange={(e) => setForm({ ...form, release_year: e.target.value })} className="bg-input mt-1" />
            </div>
          </div>
          {isNew && (
            <label htmlFor="is-plus-product" className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 px-4 py-3 cursor-pointer">
              <Checkbox
                id="is-plus-product"
                checked={isPlusProduct}
                onCheckedChange={(checked) => {
                  const enabled = checked === true;
                  setIsPlusProduct(enabled);
                  setForm((current) => ({ ...current, is_ps_plus: enabled }));
                  if (enabled) {
                    setVariants((current) => ({
                      ...current,
                      PS4PS5_secondary: { ...current.PS4PS5_secondary, enabled: false },
                    }));
                  }
                }}
                className="mt-0.5"
              />
              <div>
                <span className="block text-sm font-medium">PlayStation Plus</span>
                <span className="text-xs text-muted-foreground">Marcá esta opción para que aparezca en la categoría Plus.</span>
              </div>
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            {isNew
              ? isPlusProduct
                ? "Elegí si la cuenta Plus primaria está disponible para PS4, PS5 o ambas, con precios distintos."
                : "Más abajo podés habilitar PS4 primaria, PS5 primaria o secundaria, con precio y stock propios."
              : "Esta edición modifica únicamente la variante indicada. Para crear varias variantes juntas usá “Nuevo producto”."}
          </p>

          <div className="space-y-4 border-t border-border/70 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="featured" className="text-base">Oferta</Label>
                <p className="text-xs text-muted-foreground">Aparece en la categoría Ofertas</p>
              </div>
              <Switch id="featured" checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-base">Novedades</Label>
                <p className="text-xs text-muted-foreground">Marcá si esta publicación es estreno, preventa o ambas.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label htmlFor="is_estreno" className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 px-4 py-3 cursor-pointer">
                  <Checkbox
                    id="is_estreno"
                    checked={form.is_estreno}
                    onCheckedChange={(checked) => setForm({ ...form, is_estreno: checked === true })}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="block text-sm font-medium">Estreno</span>
                    <span className="text-xs text-muted-foreground">Aparece como lanzamiento reciente.</span>
                  </div>
                </label>
                <label htmlFor="is_preventa" className="flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 px-4 py-3 cursor-pointer">
                  <Checkbox
                    id="is_preventa"
                    checked={form.is_preventa}
                    onCheckedChange={(checked) => setForm({ ...form, is_preventa: checked === true })}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="block text-sm font-medium">Preventa</span>
                    <span className="text-xs text-muted-foreground">Aparece en la categoría de reservas anticipadas.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_active" className="text-base">Activo</Label>
                <p className="text-xs text-muted-foreground">Visible en el catálogo</p>
              </div>
              <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="card-cyber p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display font-bold text-base uppercase tracking-wider">Precio y stock</h2>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-display uppercase tracking-[0.16em] text-primary">
              <span>Cliente final global</span>
              <span>{globalMarkupPct}%</span>
            </div>
          </div>
          {isNew ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {SALE_VARIANTS.filter(({ tier }) => !isPlusProduct || tier === "primary").map(({ key, label }) => {
                const variant = variants[key];
                return (
                  <div key={key} className={`rounded-xl border p-4 space-y-4 transition-colors ${variant.enabled ? "border-primary/50 bg-primary/5" : "border-border/70 bg-background/30"}`}>
                    <label htmlFor={`variant-${key}`} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        id={`variant-${key}`}
                        checked={variant.enabled}
                        onCheckedChange={(checked) => setVariants((current) => ({
                          ...current,
                          [key]: { ...current[key], enabled: checked === true },
                        }))}
                      />
                      <span className="font-display font-bold">{label}</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`reseller-${key}`}>Precio revendedor *</Label>
                        <Input
                          id={`reseller-${key}`}
                          type="number"
                          step="1"
                          disabled={!variant.enabled}
                          value={variant.reseller_price}
                          onChange={(e) => {
                            const reseller_price = e.target.value;
                            setVariants((current) => ({
                              ...current,
                              [key]: {
                                ...current[key],
                                reseller_price,
                                price: computeFinalPrice(reseller_price, String(globalMarkupPct)),
                              },
                            }));
                          }}
                          className="bg-input mt-1"
                        />
                      </div>
                      <div>
                        <Label>Precio cliente</Label>
                        <Input value={variant.price} readOnly disabled={!variant.enabled} className="bg-input mt-1 opacity-70" />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor={`stock-${key}`}>Stock *</Label>
                        <Input
                          id={`stock-${key}`}
                          type="number"
                          min="0"
                          disabled={!variant.enabled}
                          value={variant.stock}
                          onChange={(e) => setVariants((current) => ({
                            ...current,
                            [key]: { ...current[key], stock: e.target.value },
                          }))}
                          className="bg-input mt-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reseller_price">Precio revendedor (ARS) *</Label>
              <Input id="reseller_price" type="number" step="1" required value={form.reseller_price} onChange={(e) => {
                const newReseller = e.target.value;
                const newPrice = computeFinalPrice(newReseller, String(globalMarkupPct));
                setForm({ ...form, reseller_price: newReseller, price: newPrice || form.price });
              }} className="bg-input mt-1" />
            </div>
            <div>
              <Label htmlFor="price">Precio cliente final (ARS)</Label>
              <Input id="price" type="number" step="1" value={form.price} readOnly className="bg-input mt-1 opacity-70" />
              {form.reseller_price && form.price && (
                <p className="text-xs text-primary mt-1">
                  ${form.reseller_price} + {globalMarkupPct}% = ${form.price}
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="discount_price">Precio sin oferta cliente final (ARS)</Label>
                <Switch
                  id="discount_price_enabled"
                  checked={discountPriceEnabled}
                  onCheckedChange={(checked) => {
                    setDiscountPriceEnabled(checked);
                    if (!checked) {
                      setForm((current) => ({ ...current, discount_price: "" }));
                    }
                  }}
                />
              </div>
              <Input
                id="discount_price"
                type="number"
                step="1"
                value={form.discount_price}
                onChange={(e) => setForm({ ...form, discount_price: e.target.value })}
                disabled={!discountPriceEnabled}
                className="bg-input mt-1 disabled:opacity-50"
              />
            </div>
            <div>
              <Label htmlFor="stock">Stock *</Label>
              <Input id="stock" type="number" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="bg-input mt-1" />
            </div>
          </div>
          )}
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
