import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, Package, ShoppingBag, Users, KeyRound, ClipboardList, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getStoredExchangeRates, saveExchangeRates } from "@/lib/currency";
import { toast } from "sonner";

interface AdminProduct {
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

const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const Admin = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [stats, setStats] = useState({ products: 0, orders: 0, users: 0 });
  const [rates, setRates] = useState(getStoredExchangeRates());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Admin | TIBADIGITAL";
    refresh();
  }, []);

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
    await supabase.from("products").update({ is_active: !current }).eq("id", id);
    refresh();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error("Error al eliminar");
    else { toast.success("Producto eliminado"); refresh(); }
  };

  const handleSaveRates = () => {
    const nextRates = {
      arsPerUsd: Number(rates.arsPerUsd) || 1,
      uyuPerUsd: Number(rates.uyuPerUsd) || 1,

    };
    setRates(nextRates);
    saveExchangeRates(nextRates);
    toast.success("Cotizaciones actualizadas");
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild><Link to="/admin/pedidos"><ClipboardList />Pedidos / Pagos</Link></Button>
          <Button variant="hero" asChild><Link to="/admin/producto/nuevo"><Plus />Nuevo producto</Link></Button>
        </div>
      </div>

      {/* Stats */}
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
          <h2 className="font-display font-bold text-lg uppercase tracking-wider">Divisas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Los precios base de los productos se cargan en ARS. Desde acá definís la cotización para mostrar Uruguayos y USD según el país del usuario.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">1 USD en ARS</label>
            <Input type="number" step="0.01" value={rates.arsPerUsd} onChange={(e) => setRates({ ...rates, arsPerUsd: Number(e.target.value) })} className="bg-input mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">1 USD en UYU</label>
            <Input type="number" step="0.01" value={rates.uyuPerUsd} onChange={(e) => setRates({ ...rates, uyuPerUsd: Number(e.target.value) })} className="bg-input mt-1" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button variant="hero" onClick={handleSaveRates}><Save />Guardar cotizaciones</Button>
        </div>
      </div>

      {/* Products table */}
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
                  <th className="text-left p-3">Plataforma</th>
                  <th className="text-right p-3">Precio</th>
                  <th className="text-right p-3">Stock</th>
                  <th className="text-center p-3">Estado</th>
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
                          {p.featured && <span className="text-[10px] text-primary font-display tracking-wider">★ DESTACADO</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3"><span className="text-secondary font-display text-xs">{p.platform}</span></td>
                    <td className="p-3 text-right font-semibold">{formatPrice(Number(p.discount_price ?? p.price))}</td>
                    <td className="p-3 text-right">{p.stock}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => toggleActive(p.id, p.is_active)} className={`px-2 py-0.5 rounded text-[10px] font-display tracking-wider ${p.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                        {p.is_active ? "ACTIVO" : "OCULTO"}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" asChild title="Stock de keys"><Link to={`/admin/producto/${p.id}/keys`}><KeyRound className="h-4 w-4 text-secondary" /></Link></Button>
                        <Button size="icon" variant="ghost" asChild title="Editar"><Link to={`/admin/producto/${p.id}`}><Edit className="h-4 w-4" /></Link></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteProduct(p.id)} className="hover:text-destructive" title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
