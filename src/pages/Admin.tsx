import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Edit, Trash2, Package, ShoppingBag, Users, KeyRound, ClipboardList, Save, Upload, Mail, CircleHelp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getStoredExchangeRates, saveExchangeRates } from "@/lib/currency";
import { getStoredGlobalMarkupPct, saveGlobalMarkupPct } from "@/lib/pricing";
import { getAccountTierLabel, inferAccountTier, inferPlatform } from "@/lib/productVariants";
import { cn } from "@/lib/utils";
import AdminPedidos from "./admin/AdminPedidos";
import BulkAccountImport from "./admin/BulkAccountImport";
import AdminInstructions from "./admin/AdminInstructions";
import AdminFaqs from "./admin/AdminFaqs";
import EmailPreview from "./admin/EmailPreview";
import { toast } from "sonner";

interface AdminProduct {
  account_tier?: "general" | "primary" | "secondary" | "plus";
  genre?: string | null;
  id: string;
  title: string;
  slug: string;
  price: number;
  discount_price: number | null;
  stock: number;
  platform: string;
  is_active: boolean;
  cover_url: string | null;
  featured: boolean;
}

const OFFER_LABEL = "Oferta";
const ADMIN_SECTIONS = ["productos", "pedidos", "importar", "instructivos", "faqs", "email"] as const;

type AdminSection = (typeof ADMIN_SECTIONS)[number];

const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const Admin = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [stats, setStats] = useState({ products: 0, orders: 0, users: 0 });
  const [rates, setRates] = useState(getStoredExchangeRates());
  const [globalMarkupPct, setGlobalMarkupPct] = useState(getStoredGlobalMarkupPct());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Admin | TIBADIGITAL";
    refresh();
  }, []);

  const sectionParam = searchParams.get("tab");
  const activeSection: AdminSection = ADMIN_SECTIONS.includes(sectionParam as AdminSection)
    ? (sectionParam as AdminSection)
    : "productos";

  const setActiveSection = (section: AdminSection) => {
    const nextParams = new URLSearchParams(searchParams);
    if (section === "productos") nextParams.delete("tab");
    else nextParams.set("tab", section);
    setSearchParams(nextParams, { replace: true });
  };

  const refresh = async () => {
    setLoading(true);
    const [{ data: prods }, { count: ordersCount }, { count: usersCount }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    if (prods) {
      setProducts(prods as any);
      setStats({ products: prods.length, orders: ordersCount ?? 0, users: usersCount ?? 0 });
    }
    setLoading(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("products").update({ is_active: !current }).eq("id", id);
    if (error) {
      toast.error(`No pudimos actualizar la visibilidad: ${error.message}`);
      return;
    }
    refresh();
  };

  const toggleFeatured = async (id: string, current: boolean) => {
    const { error } = await supabase.from("products").update({ featured: !current }).eq("id", id);
    if (error) {
      toast.error(`No pudimos actualizar la oferta: ${error.message}`);
      return;
    }
    refresh();
  };

  const setOfferProductsVisibility = async (visible: boolean) => {
    const offerProducts = products.filter((product) => product.featured);
    if (offerProducts.length === 0) {
      toast.error("No hay productos en oferta para actualizar");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({ is_active: visible })
      .in("id", offerProducts.map((product) => product.id));

    if (error) {
      toast.error(`No pudimos actualizar las ofertas: ${error.message}`);
      return;
    }

    toast.success(visible ? "Ofertas visibles nuevamente" : "Ofertas ocultas del catálogo");
    refresh();
  };

  const setAllProductsVisibility = async (visible: boolean) => {
    if (products.length === 0) {
      toast.error("No hay productos para actualizar");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({ is_active: visible })
      .in("id", products.map((product) => product.id));

    if (error) {
      toast.error(`No pudimos actualizar todos los productos: ${error.message}`);
      return;
    }

    toast.success(visible ? "Todos los productos visibles" : "Todos los productos ocultos");
    refresh();
  };

  const featuredProducts = products.filter((product) => product.featured);
  const hasFeaturedProducts = featuredProducts.length > 0;
  const areAllFeaturedVisible = hasFeaturedProducts && featuredProducts.every((product) => product.is_active);
  const hasProducts = products.length > 0;
  const areAllProductsVisible = hasProducts && products.every((product) => product.is_active);

  const adminSections: Array<{ id: AdminSection; label: string; Icon: typeof Package }> = [
    { id: "productos", label: "Productos", Icon: Package },
    { id: "pedidos", label: "Pedidos / Pagos", Icon: ClipboardList },
    { id: "importar", label: "Importar cuentas", Icon: Upload },
    { id: "instructivos", label: "Instructivos", Icon: FileText },
    { id: "faqs", label: "FAQs", Icon: CircleHelp },
    { id: "email", label: "Preview email", Icon: Mail },
  ];

  const deleteProduct = async (product: AdminProduct) => {
    if (!confirm(`¿Eliminar ${product.title}?`)) return;

    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) toast.error(`Error al eliminar: ${error.message}`);
    else { toast.success("Producto eliminado"); refresh(); }
  };

  const handleSaveSettings = () => {
    const nextRates = {
      arsPerUsd: Number(rates.arsPerUsd) || 1,
      uyuPerUsd: Number(rates.uyuPerUsd) || 1,

    };
    const nextGlobalMarkupPct = Number(globalMarkupPct);

    setRates(nextRates);
    setGlobalMarkupPct(Number.isFinite(nextGlobalMarkupPct) ? nextGlobalMarkupPct : 0);
    saveExchangeRates(nextRates);
    saveGlobalMarkupPct(Number.isFinite(nextGlobalMarkupPct) ? nextGlobalMarkupPct : 0);
    toast.success("Configuración comercial actualizada");
  };

  return (
    <div className="container py-12">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display mb-2">// Panel admin</div>
          <h1 className="font-display font-black text-3xl md:text-5xl">
            PANEL <span className="text-gradient-neon">ADMINISTADOR</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div
            className={cn(
              "inline-flex items-center gap-3 rounded-full border px-4 py-2.5 backdrop-blur-sm transition-colors",
              areAllProductsVisible
                ? "border-secondary/40 bg-secondary/10 shadow-[0_0_30px_hsl(var(--secondary)/0.12)]"
                : "border-border bg-card/40",
            )}
          >
            <div className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-colors",
                  areAllProductsVisible ? "bg-secondary shadow-[0_0_12px_hsl(var(--secondary))]" : "bg-muted-foreground/40",
                )}
              />
              <span className="text-[11px] font-display uppercase tracking-[0.28em] text-foreground/90">Productos</span>
            </div>
            <Switch
              checked={areAllProductsVisible}
              onCheckedChange={setAllProductsVisibility}
              disabled={!hasProducts}
              aria-label="Mostrar u ocultar todos los productos"
            />
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-3 rounded-full border px-4 py-2.5 backdrop-blur-sm transition-colors",
              areAllFeaturedVisible
                ? "border-primary/40 bg-primary/10 shadow-[0_0_30px_hsl(var(--primary)/0.12)]"
                : "border-border bg-card/40",
            )}
          >
            <div className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-colors",
                  areAllFeaturedVisible ? "bg-primary shadow-[0_0_12px_hsl(var(--primary))]" : "bg-muted-foreground/40",
                )}
              />
              <span className="text-[11px] font-display uppercase tracking-[0.28em] text-foreground/90">Ofertas</span>
            </div>
            <Switch
              checked={areAllFeaturedVisible}
              onCheckedChange={setOfferProductsVisibility}
              disabled={!hasFeaturedProducts}
              aria-label="Mostrar u ocultar ofertas"
            />
          </div>

          <Button variant="hero" asChild>
            <Link to="/admin/producto/nuevo"><Plus />Nuevo producto</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 mb-8 sm:grid-cols-2 xl:grid-cols-6">
        {adminSections.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSection(id)}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-center text-xs font-display uppercase tracking-[0.18em] transition-colors",
              activeSection === id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeSection === "productos" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { Icon: Package, label: "Productos", value: stats.products, color: "primary" },
              { Icon: ShoppingBag, label: "Pedidos", value: stats.orders, color: "secondary" },
              { Icon: Users, label: "Usuarios", value: stats.users, color: "primary" },
            ].map(({ Icon, label, value, color }) => (
              <div key={label} className="card-cyber p-6 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
                  <div className="font-display font-black text-3xl text-gradient-neon mt-1">{value}</div>
                </div>
                <div className={`w-12 h-12 rounded-lg bg-${color}/20 text-${color} flex items-center justify-center`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>

          <div className="card-cyber p-6 rounded-xl space-y-4 mb-8">
            <div>
              <h2 className="font-display font-bold text-lg uppercase tracking-wider">Divisas y margen</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Definí las cotizaciones y el porcentaje cliente final por defecto para nuevos productos.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">1 USD en ARS</label>
                <Input type="number" step="0.01" value={rates.arsPerUsd} onChange={(e) => setRates({ ...rates, arsPerUsd: Number(e.target.value) })} className="bg-input mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">1 USD en UYU</label>
                <Input type="number" step="0.01" value={rates.uyuPerUsd} onChange={(e) => setRates({ ...rates, uyuPerUsd: Number(e.target.value) })} className="bg-input mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Porcentaje cliente final global (%)</label>
                <Input type="number" step="1" value={globalMarkupPct} onChange={(e) => setGlobalMarkupPct(Number(e.target.value))} className="bg-input mt-1" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="hero" onClick={handleSaveSettings}><Save />Guardar configuración</Button>
            </div>
          </div>

          <div className="card-cyber rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-display font-bold text-lg uppercase tracking-wider">Productos</h2>
            </div>
            {loading ? (
              <div className="p-10 text-center text-muted-foreground">Cargando...</div>
            ) : products.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Package className="h-10 w-10 mx-auto text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No hay productos cargados aún.</p>
                <Button variant="neon" asChild><Link to="/admin/producto/nuevo"><Plus />Cargar primer producto</Link></Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Producto</th>
                      <th className="text-left p-3">Variante</th>
                      <th className="text-right p-3">Precio</th>
                      <th className="text-right p-3">Stock</th>
                      <th className="text-center p-3">Visible</th>
                      <th className="text-center p-3">{OFFER_LABEL}</th>
                      <th className="text-right p-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-12 rounded bg-muted overflow-hidden shrink-0">
                              {p.cover_url && <img src={p.cover_url} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <div>
                              <div className="font-semibold">{p.title}</div>
                              {p.featured && <span className="text-[10px] text-primary font-display tracking-wider">★ EN OFERTA</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-secondary font-display text-xs">{inferPlatform(p)}</div>
                          <div className="text-[11px] text-muted-foreground">{getAccountTierLabel(inferAccountTier(p))}</div>
                        </td>
                        <td className="p-3 text-right font-semibold">{formatPrice(Number(p.discount_price ?? p.price))}</td>
                        <td className="p-3 text-right">{p.stock}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => toggleActive(p.id, p.is_active)} className={`px-2 py-0.5 rounded text-[10px] font-display tracking-wider ${p.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                            {p.is_active ? "ACTIVO" : "OCULTO"}
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => toggleFeatured(p.id, p.featured)} className={`px-2 py-0.5 rounded text-[10px] font-display tracking-wider ${p.featured ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {p.featured ? "EN OFERTA" : "NORMAL"}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" asChild title="Stock de keys"><Link to={`/admin/producto/${p.id}/keys`}><KeyRound className="h-4 w-4 text-secondary" /></Link></Button>
                            <Button size="icon" variant="ghost" asChild title="Editar"><Link to={`/admin/producto/${p.id}`}><Edit className="h-4 w-4" /></Link></Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteProduct(p)} className="hover:text-destructive" title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : activeSection === "pedidos" ? (
        <AdminPedidos embedded />
      ) : activeSection === "importar" ? (
        <BulkAccountImport embedded />
      ) : activeSection === "instructivos" ? (
        <AdminInstructions embedded />
      ) : activeSection === "faqs" ? (
        <AdminFaqs embedded />
      ) : (
        <EmailPreview embedded />
      )}
    </div>
  );
};

export default Admin;
