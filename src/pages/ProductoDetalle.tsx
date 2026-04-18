import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ShoppingCart, Zap, Shield, ChevronLeft, Calendar, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { getPricePresentation } from "@/lib/currency";

interface ProductFull {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  cover_url: string | null;
  gallery: string[];
  platform: string;
  genre: string | null;
  release_year: number | null;
  stock: number;
}

const ProductoDetalle = () => {
  const { slug } = useParams();
  const [product, setProduct] = useState<ProductFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState<string>("");
  const [qty, setQty] = useState(1);
  const { country } = useAuth();
  const { addToCart } = useCart();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    supabase.from("products").select("*").eq("slug", slug).eq("is_active", true).maybeSingle().then(({ data }) => {
      if (data) {
        setProduct(data as any);
        setActiveImg(data.cover_url ?? "");
        document.title = `${data.title} | TIBADIGITAL`;
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return (
    <div className="container py-20 text-center text-muted-foreground">Cargando...</div>
  );
  if (!product) return (
    <div className="container py-20 text-center space-y-4">
      <h1 className="font-display text-3xl">Producto no encontrado</h1>
      <Button variant="neon" asChild><Link to="/catalogo">Volver al catálogo</Link></Button>
    </div>
  );

  const finalPrice = Number(product.discount_price ?? product.price);
  const hasDiscount = product.discount_price && Number(product.discount_price) < Number(product.price);
  const images = [product.cover_url, ...(product.gallery || [])].filter(Boolean) as string[];
  const originalPriceView = getPricePresentation(Number(product.price), country);
  const finalPriceView = getPricePresentation(finalPrice, country);
  const installmentView = getPricePresentation(finalPrice / 12, country);

  return (
    <div className="container py-10">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/catalogo"><ChevronLeft />Volver</Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 xl:gap-10 items-start">
        {/* Gallery */}
        <div className="space-y-4 lg:pr-2">
          <div className="relative aspect-[4/5] min-h-[520px] lg:min-h-[640px] rounded-xl overflow-hidden card-cyber">
            {activeImg ? (
              <img src={activeImg} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid-bg flex items-center justify-center">
                <Zap className="h-16 w-16 opacity-30" />
              </div>
            )}
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1.5 text-xs font-display font-bold tracking-wider rounded-md bg-background/80 backdrop-blur border border-secondary/50 text-secondary">
                {product.platform}
              </span>
            </div>
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(img)}
                  className={`relative aspect-square w-20 rounded-md overflow-hidden border-2 transition-all shrink-0 ${activeImg === img ? "border-primary glow-soft" : "border-border opacity-60 hover:opacity-100"}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display mb-2">
              {product.genre ?? "Videojuego"}
            </div>
            <h1 className="font-display font-black text-3xl md:text-5xl leading-tight">{product.title}</h1>
          </div>

          {/* Price */}
          <div className="card-cyber p-6 rounded-xl space-y-3">
            <div className="flex items-end gap-3 flex-wrap">
              {hasDiscount && (
                <span className="text-lg text-muted-foreground line-through">{originalPriceView.primary}</span>
              )}
              <span className="text-4xl md:text-5xl font-display font-black text-gradient-neon">
                {finalPriceView.primary}
              </span>
              {hasDiscount && (
                <span className="px-2 py-1 text-xs font-display font-black rounded-md bg-gradient-cyber text-white">
                  -{Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)}%
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              {finalPriceView.secondary && <div>{finalPriceView.secondary}</div>}
              <div>o 12 cuotas sin interés de {installmentView.primary}</div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <div className="flex items-center border border-border rounded-md">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 hover:text-primary transition-colors">−</button>
                <span className="px-4 font-display font-bold">{qty}</span>
                <button onClick={() => setQty(Math.min(product.stock, qty + 1))} className="px-3 py-2 hover:text-primary transition-colors">+</button>
              </div>
              <Button
                variant="hero"
                size="lg"
                className="flex-1"
                disabled={product.stock === 0}
                onClick={() => addToCart(product.id, qty)}
              >
                <ShoppingCart />
                {product.stock === 0 ? "Sin stock" : "Agregar al carrito"}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-xs text-success pt-1">
              <Shield className="h-3.5 w-3.5" />
              {product.stock > 0 ? `${product.stock} en stock — Envío inmediato` : "Sin stock disponible"}
            </div>
          </div>

          {/* Specs */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: Gamepad2, label: "Plataforma", value: product.platform },
              { Icon: Calendar, label: "Año", value: product.release_year ?? "—" },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="card-cyber p-3 rounded-lg text-center">
                <Icon className="h-4 w-4 mx-auto text-secondary mb-1" />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="font-display font-bold text-sm">{value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {product.description && (
            <div className="space-y-2">
              <h2 className="font-display font-bold text-lg uppercase tracking-wider">Descripción</h2>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductoDetalle;
