import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const Estrenos = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Estrenos y Preventas | TIBADIGITAL";
    setLoading(true);
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("release_year", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setProducts(data as any);
        setLoading(false);
      });
  }, []);

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container py-12">
      <div className="mb-10 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display">// Lo más nuevo</div>
        <h1 className="font-display font-black text-4xl md:text-6xl">
          ESTRENOS Y <span className="text-gradient-neon">PREVENTAS</span>
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Input
          placeholder="Buscar juego..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs bg-card border-border focus-visible:ring-primary"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 card-cyber rounded-2xl">
          <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground">Próximamente nuevos estrenos.</p>
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

export default Estrenos;
