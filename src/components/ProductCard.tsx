import { Link } from "react-router-dom";
import { ShoppingCart, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { getPricePresentation } from "@/lib/currency";

export interface Product {
  id: string;
  title: string;
  slug: string;
  price: number;
  discount_price: number | null;
  cover_url: string | null;
  platform: string;
  featured?: boolean;
  stock: number;
}

export const ProductCard = ({ product }: { product: Product }) => {
  const { addToCart } = useCart();
  const { country } = useAuth();
  const finalPrice = Number(product.discount_price ?? product.price);
  const hasDiscount = product.discount_price && Number(product.discount_price) < Number(product.price);
  const discountPct = hasDiscount
    ? Math.round((1 - Number(product.discount_price) / Number(product.price)) * 100)
    : 0;
  const basePriceView = getPricePresentation(Number(product.price), country);
  const finalPriceView = getPricePresentation(finalPrice, country);

  return (
    <article className="card-cyber rounded-xl overflow-hidden group relative animate-fade-in">
      {/* Glow border on hover */}
      <div className="absolute inset-0 bg-gradient-cyber opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none rounded-xl blur-xl -z-10" />

      <Link to={`/producto/${product.slug}`} className="block relative aspect-[3/4] overflow-hidden bg-muted">
        {product.cover_url ? (
          <img
            src={product.cover_url}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full grid-bg flex items-center justify-center text-muted-foreground">
            <Zap className="h-12 w-12 opacity-30" />
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className="px-2.5 py-1 text-[10px] font-display font-bold tracking-wider rounded-md bg-background/80 backdrop-blur border border-secondary/50 text-secondary">
            {product.platform}
          </span>
          {hasDiscount && (
            <span className="px-2.5 py-1 text-[10px] font-display font-black tracking-wider rounded-md bg-gradient-cyber text-white shadow-[0_0_15px_hsl(var(--primary)/0.6)]">
              -{discountPct}%
            </span>
          )}
        </div>

        {product.stock === 0 && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur flex items-center justify-center">
            <span className="font-display font-bold text-destructive text-lg tracking-widest">SIN STOCK</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-80" />
      </Link>

      <div className="p-4 space-y-3">
        <Link to={`/producto/${product.slug}`}>
          <h3 className="font-display font-bold text-base line-clamp-2 group-hover:text-primary transition-colors min-h-[3rem]">
            {product.title}
          </h3>
        </Link>

        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col">
            {hasDiscount && (
              <span className="text-xs text-muted-foreground line-through">
                {basePriceView.primary}
              </span>
            )}
            <span className="text-xl font-display font-black text-gradient-neon">
              {finalPriceView.primary}
            </span>
            {finalPriceView.secondary && (
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {finalPriceView.secondary}
              </span>
            )}
          </div>
          <Button
            size="icon"
            variant="neon"
            disabled={product.stock === 0}
            onClick={(e) => { e.preventDefault(); addToCart(product.id); }}
            aria-label="Agregar al carrito"
            className="shrink-0"
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
};
