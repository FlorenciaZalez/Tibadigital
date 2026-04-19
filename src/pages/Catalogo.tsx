import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { inferPlatform } from "@/lib/productVariants";

const PLATFORMS = ["PS4", "PS5"];

const Catalogo = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const platform = searchParams.get("platform");
  const featuredOnly = searchParams.get("featured") === "true" || location.pathname === "/ofertas";

  useEffect(() => {
    document.title = featuredOnly ? "Ofertas | TIBADIGITAL" : `Catálogo${platform ? ` ${platform}` : ""} | TIBADIGITAL`;
    setLoading(true);
    let q = supabase.from("products").select("*").eq("is_active", true);
    if (featuredOnly) q = q.eq("featured", true);
    q.order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setProducts(data as any);
      setLoading(false);
    });
  }, [platform, featuredOnly]);

  const filtered = products.filter((p) =>
    (!platform || [platform, "PS4/PS5"].includes(inferPlatform(p))) &&
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const setFilter = (key: string, value: string | null) => {
    const np = new URLSearchParams(searchParams);
    if (value) np.set(key, value);
    else np.delete(key);
    setSearchParams(np);
  };

  return (
    <div className="container py-12">
      {/* Header */}
      <div className="mb-10 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display">// Catálogo</div>
        <h1 className="font-display font-black text-4xl md:text-6xl">
          {platform ? (
            <>JUEGOS <span className="text-gradient-neon">{platform}</span></>
          ) : featuredOnly ? (
            <>NUESTRAS <span className="text-gradient-neon">OFERTAS</span></>
          ) : (
            <>TODO EL <span className="text-gradient-neon">CATÁLOGO</span></>
          )}
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Input
          placeholder="Buscar juego..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs bg-card border-border focus-visible:ring-primary"
        />
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={platform === p ? "default" : "outline"}
              onClick={() => setFilter("platform", platform === p ? null : p)}
            >
              {p}
            </Button>
          ))}
          {(platform || featuredOnly) && (
            <Button size="sm" variant="ghost" onClick={() => setSearchParams({})}>
              <X className="h-4 w-4" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 card-cyber rounded-2xl">
          <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground">No se encontraron juegos con estos filtros.</p>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground mb-4">{filtered.length} juego{filtered.length !== 1 && "s"}</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
};

export default Catalogo;
