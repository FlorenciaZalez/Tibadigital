import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Zap, Shield, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard, type Product } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";

const heroBgImg = "/imghero.jpg";

const Index = () => {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [latest, setLatest] = useState<Product[]>([]);

  useEffect(() => {
    document.title = "TIBADIGITAL — Tienda gamer de PlayStation";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Comprá juegos de PlayStation 5, PS4 y más. Envíos rápidos, mejores precios y la mejor experiencia gamer en TIBADIGITAL.");

    Promise.all([
      supabase.from("products").select("*").eq("featured", true).eq("is_active", true).limit(8),
      supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(4),
    ]).then(([f, l]) => {
      if (f.data) setFeatured(f.data as any);
      if (l.data) setLatest(l.data as any);
    });
  }, []);

  return (
    <div>
      {/* HERO */}
      <section className="relative -mt-16 min-h-[calc(78vh+4rem)] flex items-center overflow-x-clip">
        <div className="absolute inset-x-0 top-0 bottom-0 z-0 overflow-hidden">
          <img
            src={heroBgImg}
            alt=""
            width={1920}
            height={1080}
            className="h-full w-full scale-[1.03] object-cover object-[center_16%] opacity-95"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/30 to-background/5" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-transparent to-background/82" />
          <div className="absolute inset-0 grid-bg opacity-10" />
        </div>

        <div className="container relative z-10 pt-28 pb-16 md:pt-32 md:pb-24">
          <div className="max-w-3xl space-y-7 animate-fade-in-up">
            <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-[0.95]">
              <span className="block text-foreground">LOS MEJORES</span>
              <span className="block text-gradient-neon animate-text-glow">JUEGOS</span>
              <span className="block text-foreground/90">ACÁ.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl">
              Los mejores juegos de <span className="text-secondary font-semibold">PlayStation</span>, al mejor precio.
              Soporte 24/7, entrega rápida y una experiencia pensada para jugadores reales.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button size="xl" variant="hero" asChild>
                <Link to="/catalogo">
                  Explorar catálogo
                  <ArrowRight className="ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background border-t border-border/20">
        <div className="container py-8 md:py-10">
          <div className="grid w-full grid-cols-1 gap-8 text-center sm:grid-cols-3 sm:gap-6 md:gap-12">
            {[
              { num: "1000+", label: "Juegos" },
              { num: "10K+", label: "Gamers" },
              { num: "24/7", label: "Soporte" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center justify-center space-y-1">
                <div className="font-display font-black text-2xl md:text-3xl text-gradient-neon">{s.num}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFITS BAR */}
      <section className="border-y border-border/40 bg-card/30 backdrop-blur">
        <div className="container py-6">
          <div className="grid grid-cols-1 gap-6 text-center md:grid-cols-3 md:gap-8">
            {[
              { Icon: Shield, title: "100% original", desc: "Productos garantizados" },
              { Icon: Zap, title: "Entrega rápida", desc: "1-2 hs" },
              { Icon: Sparkles, title: "Mejores precios", desc: "Cuotas sin interés" },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex w-full items-center justify-center gap-3 group">
                <div className="w-10 h-10 rounded-lg bg-gradient-cyber/20 border border-primary/30 flex items-center justify-center text-primary group-hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)] transition-all">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-display font-bold text-sm uppercase tracking-wide">{title}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORMS */}
      <section className="container py-20">
        <div className="text-center mb-12 space-y-3">
          <h2 className="font-display font-black text-3xl md:text-5xl">
            ELEGÍ TU <span className="text-gradient-neon">CONSOLA</span>
          </h2>
          <p className="text-muted-foreground">Encontrá todos los juegos para tu consola</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {["PS5", "PS4", "Playstation Plus"].map((p, i) => (
            <Link
              key={p}
              to={`/catalogo?platform=${p}`}
              className="group relative flex min-h-[180px] w-full items-center justify-center card-cyber rounded-xl p-8 text-center overflow-hidden"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="absolute inset-0 bg-gradient-cyber opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="relative">
                <div className="font-display font-black text-5xl md:text-6xl text-foreground group-hover:text-gradient-neon transition-all">
                  {p}
                </div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-3">
                  Ver juegos
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* OFFERS */}
      {featured.length > 0 && (
        <section className="container py-12">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-secondary mb-2 font-display">// Ofertas</div>
              <h2 className="font-display font-black text-3xl md:text-5xl">
                OFERTAS <span className="text-gradient-neon">DESTACADAS</span>
              </h2>
            </div>
            <Button variant="neon" asChild>
              <Link to="/ofertas">Ver ofertas<ArrowRight /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* LATEST */}
      {latest.length > 0 && (
        <section className="container py-12">
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-secondary mb-2 font-display">// Novedades</div>
              <h2 className="font-display font-black text-3xl md:text-5xl">
                ÚLTIMOS <span className="text-gradient-neon">LANZAMIENTOS</span>
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {latest.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Empty state */}
      {featured.length === 0 && latest.length === 0 && (
        <section className="container py-20 text-center">
          <div className="max-w-md mx-auto card-cyber rounded-2xl p-10 space-y-4">
            <Zap className="h-12 w-12 mx-auto text-primary animate-float" />
            <h3 className="font-display font-bold text-2xl">Catálogo vacío</h3>
            <p className="text-muted-foreground">Aún no hay productos cargados. Iniciá sesión como admin y cargá los primeros juegos.</p>
            <Button variant="hero" asChild><Link to="/auth">Acceder al admin</Link></Button>
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="container py-20">
        <div className="relative card-cyber rounded-2xl p-10 md:p-16 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-cyber opacity-10" />
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary/30 rounded-full blur-3xl animate-glow-pulse" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-secondary/30 rounded-full blur-3xl animate-glow-pulse" />
          <div className="relative max-w-2xl space-y-5">
            <h2 className="font-display font-black text-3xl md:text-5xl">
              ¿LISTO PARA <span className="text-gradient-neon">JUGAR?</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Creá tu cuenta y empezá a coleccionar los mejores juegos. Ofertas exclusivas para miembros.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" variant="cyan" asChild>
                <Link to="/catalogo">Ver catálogo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;
