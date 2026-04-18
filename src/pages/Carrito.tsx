import { Link, useNavigate } from "react-router-dom";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { getPricePresentation } from "@/lib/currency";
import { useEffect } from "react";

const Carrito = () => {
  const { items, total, updateQuantity, removeItem } = useCart();
  const { user, country } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Carrito | TIBADIGITAL";
  }, []);

  if (!user) {
    return (
      <div className="container py-20 text-center max-w-md mx-auto space-y-5">
        <ShoppingBag className="h-16 w-16 mx-auto text-primary opacity-60" />
        <h1 className="font-display font-black text-3xl">Tu carrito está esperando</h1>
        <p className="text-muted-foreground">Iniciá sesión para ver tu carrito y completar tu compra.</p>
        <Button variant="hero" size="lg" asChild><Link to="/auth">Iniciar sesión</Link></Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container py-20 text-center max-w-md mx-auto space-y-5">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
        <h1 className="font-display font-black text-3xl">Tu carrito está vacío</h1>
        <p className="text-muted-foreground">Explorá el catálogo y agregá tus juegos favoritos.</p>
        <Button variant="hero" size="lg" asChild>
          <Link to="/catalogo">Ver catálogo<ArrowRight /></Link>
        </Button>
      </div>
    );
  }

  const totalView = getPricePresentation(total, country);

  return (
    <div className="container py-12">
      <h1 className="font-display font-black text-4xl md:text-5xl mb-8">
        TU <span className="text-gradient-neon">CARRITO</span>
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => {
            const price = Number(item.product.discount_price ?? item.product.price);
            const itemTotalView = getPricePresentation(price * item.quantity, country);
            return (
              <div key={item.id} className="card-cyber p-4 rounded-xl flex gap-4 animate-fade-in">
                <Link to={`/producto/${item.product.slug}`} className="shrink-0 w-20 h-28 md:w-24 md:h-32 rounded-md overflow-hidden bg-muted">
                  {item.product.cover_url && (
                    <img src={item.product.cover_url} alt={item.product.title} className="w-full h-full object-cover" />
                  )}
                </Link>
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="text-xs text-secondary font-display tracking-widest mb-1">{item.product.platform}</div>
                      <Link to={`/producto/${item.product.slug}`} className="font-display font-bold hover:text-primary transition-colors">
                        {item.product.title}
                      </Link>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center border border-border rounded-md">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 hover:text-primary"><Minus className="h-3 w-3" /></button>
                      <span className="px-3 font-display font-bold text-sm">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 hover:text-primary"><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-black text-lg text-gradient-neon">
                        {itemTotalView.primary}
                      </div>
                      {itemTotalView.secondary && (
                        <div className="text-[11px] text-muted-foreground">{itemTotalView.secondary}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 h-fit">
          <div className="card-cyber p-6 rounded-xl space-y-4">
            <h2 className="font-display font-bold text-xl uppercase tracking-wider">Resumen</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{totalView.primary}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Envío</span>
                <span className="text-success">Gratis</span>
              </div>
              <div className="border-t border-border my-3" />
              <div className="flex justify-between items-baseline gap-3">
                <span className="font-display font-bold text-base uppercase tracking-wider">Total</span>
                <div className="text-right">
                  <span className="font-display font-black text-2xl text-gradient-neon">{totalView.primary}</span>
                  {totalView.secondary && <div className="text-[11px] text-muted-foreground">{totalView.secondary}</div>}
                </div>
              </div>
            </div>
            <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/checkout")}>
              <CreditCard />Finalizar compra
            </Button>
            <Button variant="ghost" size="sm" asChild className="w-full">
              <Link to="/catalogo">Seguir comprando</Link>
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Carrito;
