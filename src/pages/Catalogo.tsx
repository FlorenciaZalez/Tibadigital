import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { ChevronDown, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { inferAccountTier, inferPlatform } from "@/lib/productVariants";

const PLATFORM_OPTIONS = [
  { value: "all", label: "Todas las plataformas" },
  { value: "PS4", label: "PS4" },
  { value: "PS5", label: "PS5" },
] as const;
const SORT_OPTIONS = [
  { value: "recent", label: "Recientes" },
  { value: "alpha-asc", label: "A-Z" },
  { value: "alpha-desc", label: "Z-A" },
] as const;
const FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "offer", label: "Oferta" },
  { value: "list", label: "Precio lista" },
  { value: "primary", label: "Primarias" },
  { value: "secondary", label: "Secundarias" },
  { value: "plus", label: "Plus" },
  { value: "estreno", label: "Estreno y preventa" },
  { value: "sin-stock", label: "Sin stock" },
] as const;

type CatalogFilterValue = (typeof FILTER_OPTIONS)[number]["value"];

const FILTER_LABELS: Record<CatalogFilterValue, string> = {
  all: "Todos",
  offer: "Oferta",
  list: "Precio lista",
  primary: "Primarias",
  secondary: "Secundarias",
  plus: "Plus",
  estreno: "Estreno y preventa",
  "sin-stock": "Sin stock",
};

const PRICE_FILTERS: CatalogFilterValue[] = ["offer", "list"];
const TIER_FILTERS: CatalogFilterValue[] = ["primary", "secondary", "plus"];

const isCatalogFilterValue = (value: string): value is CatalogFilterValue =>
  FILTER_OPTIONS.some((option) => option.value === value);

const hasOfferPrice = (product: Product) =>
  product.featured === true || (product.discount_price != null && Number(product.discount_price) < Number(product.price));

const Catalogo = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isOffersPage = location.pathname === "/ofertas";
  const platform = searchParams.get("platform") ?? "all";
  const sort = searchParams.get("sort") ?? "recent";
  const explicitSelectedFilters = (() => {
    const rawFilters = searchParams.get("filters")?.split(",").filter(Boolean) ?? [];
    if (rawFilters.length > 0) {
      return rawFilters.filter(isCatalogFilterValue);
    }

    const legacyFilters: CatalogFilterValue[] = [];
    if (searchParams.get("price") === "list") legacyFilters.push("list");
    if (searchParams.get("featured") === "true" || searchParams.get("price") === "offer") legacyFilters.push("offer");
    if (searchParams.get("tier") === "primary") legacyFilters.push("primary");
    if (searchParams.get("tier") === "secondary") legacyFilters.push("secondary");
    if (searchParams.get("tier") === "plus") legacyFilters.push("plus");
    if (searchParams.get("stock") === "sin-stock") legacyFilters.push("sin-stock");
    return legacyFilters;
  })();
  const selectedFilters = Array.from(new Set(isOffersPage ? ["offer", ...explicitSelectedFilters] : explicitSelectedFilters));
  const featuredOnly = selectedFilters.includes("offer");
  const hasActiveFilters = Boolean(
    platform !== "all" ||
    sort !== "recent" ||
    explicitSelectedFilters.length > 0
  );
  const activeFilterTags = [
    ...(platform !== "all" ? [{ key: `platform:${platform}`, label: platform }] : []),
    ...explicitSelectedFilters.map((value) => ({ key: `filter:${value}`, label: FILTER_LABELS[value] })),
  ];
  const platformLabel = platform === "all" ? "PS4/PS5" : platform;

  useEffect(() => {
    document.title = featuredOnly ? "Ofertas | TIBADIGITAL" : `Catálogo${platform !== "all" ? ` ${platform}` : ""} | TIBADIGITAL`;
    setLoading(true);
    let q = supabase.from("products").select("*").eq("is_active", true);
    q.order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setProducts(data as any);
      setLoading(false);
    });
  }, [platform, featuredOnly]);

  const filtered = products
    .filter((product) => {
      if (platform !== "all" && ![platform, "PS4/PS5"].includes(inferPlatform(product))) return false;

      const priceFilters = selectedFilters.filter((value): value is "offer" | "list" => PRICE_FILTERS.includes(value));
      if (priceFilters.length > 0 && !priceFilters.some((value) => (value === "offer" ? hasOfferPrice(product) : !hasOfferPrice(product)))) {
        return false;
      }

      const tierFilters = selectedFilters.filter((value): value is "primary" | "secondary" | "plus" => TIER_FILTERS.includes(value));
      if (tierFilters.length > 0 && !tierFilters.includes(inferAccountTier(product))) {
        return false;
      }

      if (selectedFilters.includes("estreno") && product.is_estreno !== true && product.is_preventa !== true) return false;
      if (selectedFilters.includes("sin-stock")) {
        if (product.stock > 0) return false;
      } else if (product.stock <= 0) {
        return false;
      }

      return product.title.toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      if (sort === "alpha-asc") return a.title.localeCompare(b.title, "es", { sensitivity: "base" });
      if (sort === "alpha-desc") return b.title.localeCompare(a.title, "es", { sensitivity: "base" });
      return 0;
    });

  const setParam = (key: string, value: string | null) => {
    const np = new URLSearchParams(searchParams);
    if (value) np.set(key, value);
    else np.delete(key);
    setSearchParams(np);
  };

  const setExplicitFilters = (values: CatalogFilterValue[]) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("filters");
    nextParams.delete("price");
    nextParams.delete("featured");
    nextParams.delete("tier");
    nextParams.delete("stock");

    const normalizedValues = values.filter((value) => value !== "all");
    if (normalizedValues.length > 0) {
      nextParams.set("filters", normalizedValues.join(","));
    }

    setSearchParams(nextParams);
  };

  const toggleExplicitFilter = (value: CatalogFilterValue) => {
    if (value === "all") {
      setExplicitFilters([]);
      return;
    }

    if (isOffersPage && value === "offer") return;

    const nextValues = explicitSelectedFilters.includes(value)
      ? explicitSelectedFilters.filter((current) => current !== value)
      : [...explicitSelectedFilters, value];

    setExplicitFilters(nextValues);
  };

  const removeTag = (key: string) => {
    if (key.startsWith("platform:")) {
      setParam("platform", null);
      return;
    }

    const value = key.replace("filter:", "");
    if (isCatalogFilterValue(value)) {
      setExplicitFilters(explicitSelectedFilters.filter((current) => current !== value));
    }
  };

  const clearFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("platform");
    nextParams.delete("sort");
    nextParams.delete("filters");
    nextParams.delete("price");
    nextParams.delete("featured");
    nextParams.delete("tier");
    nextParams.delete("stock");
    setSearchParams(nextParams);
  };

  return (
    <div className="container py-12">
      {/* Header */}
      <div className="mb-10 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display">// Catálogo</div>
        <h1 className="font-display font-black text-4xl md:text-6xl">
          {platform !== "all" ? (
            <>JUEGOS <span className="text-gradient-neon">{platform}</span></>
          ) : isOffersPage ? (
            <>TODO EN <span className="text-gradient-neon">OFERTA</span></>
          ) : featuredOnly ? (
            <>CATÁLOGO EN <span className="text-gradient-neon">OFERTA</span></>
          ) : (
            <>TODO EL <span className="text-gradient-neon">CATÁLOGO</span></>
          )}
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-8">
        <Input
          placeholder="Buscar juego..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs bg-card border-border focus-visible:ring-primary"
        />
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[180px] justify-between border-border bg-card text-sm font-medium hover:bg-card/80">
                <span>{platformLabel}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[180px]">
              {PLATFORM_OPTIONS.map((option) => (
                <DropdownMenuItem key={option.value} onClick={() => setParam("platform", option.value === "all" ? null : option.value)}>
                  {option.value === "all" ? "Ambas consolas" : option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[220px] justify-between border-border bg-card text-sm font-medium hover:bg-card/80">
                <span>Filtrar por</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px]">
              {FILTER_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.value}
                  checked={selectedFilters.includes(option.value)}
                  onCheckedChange={() => toggleExplicitFilter(option.value)}
                  disabled={isOffersPage && option.value === "offer"}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={sort === option.value ? "default" : "outline"}
              onClick={() => setParam("sort", option.value === "recent" ? null : option.value)}
            >
              {option.label}
            </Button>
          ))}
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4" /> Borrar filtros
            </Button>
          )}
        </div>
      </div>

      {activeFilterTags.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {activeFilterTags.map((tag) => (
            <Badge
              key={tag.key}
              variant="outline"
              className="gap-1 rounded-full border-primary/40 bg-primary/10 px-3 py-1 text-foreground"
            >
              <span>{tag.label}</span>
              <button
                type="button"
                onClick={() => removeTag(tag.key)}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`Quitar filtro ${tag.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className={cn(
              "text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground",
              !hasActiveFilters && "hidden",
            )}
          >
            Borrar todo
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div className="text-sm text-muted-foreground">{filtered.length} juego{filtered.length !== 1 && "s"}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-[0.18em]">
              {sort === "alpha-asc" ? "Orden: A-Z" : sort === "alpha-desc" ? "Orden: Z-A" : "Orden: recientes"}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </div>
  );
};

export default Catalogo;
