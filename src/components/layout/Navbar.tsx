import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ShoppingCart, User, LogOut, Menu, X, Shield, Search, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import type { CountryCode } from "@/lib/currency";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const catalogSubLinks = [
  { to: "/catalogo", label: "Ver todo" },
  { to: "/catalogo?platform=PS5", label: "PS5" },
  { to: "/catalogo?platform=PS4", label: "PS4" },
  { to: "/secundarias", label: "Secundarias" },
  { to: "/ps-plus", label: "PlayStation Plus" }
];

const navLinks = [
  { to: "/ofertas", label: "Ofertas" },
  { to: "/estrenos", label: "Estrenos y preventas" },
];

const COUNTRY_FLAGS: Record<CountryCode, { flag: string; label: string }> = {
  AR: { flag: "🇦🇷", label: "Argentina (ARS)" },
  UY: { flag: "🇺🇾", label: "Uruguay (UYU)" },
  OTHER: { flag: "🌎", label: "Internacional (USD)" },
};

export const Navbar = () => {
  const { user, isAdmin, signOut, country, setCountry } = useAuth();
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/70 backdrop-blur-md">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-background/20 to-transparent" />
      <div className="container relative flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden lg:flex items-center gap-7">
          {/* Catálogo dropdown */}
          <DropdownMenu open={catalogOpen} onOpenChange={setCatalogOpen}>
            <div onMouseEnter={() => setCatalogOpen(true)} onMouseLeave={() => setCatalogOpen(false)}>
            <DropdownMenuTrigger className="relative font-display text-sm font-semibold uppercase tracking-[0.14em] text-foreground/80 hover:text-primary transition-colors flex items-center gap-1 outline-none after:content-[''] after:absolute after:left-0 after:bottom-[-6px] after:h-[2px] after:w-0 after:bg-gradient-cyber after:transition-all hover:after:w-full">
              Catálogo <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-card border-border min-w-[160px]" onMouseEnter={() => setCatalogOpen(true)} onMouseLeave={() => setCatalogOpen(false)}>
              {catalogSubLinks.map((sub) => (
                <DropdownMenuItem key={sub.label} asChild>
                  <Link to={sub.to} className="font-display text-sm uppercase tracking-wider">{sub.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
            </div>
          </DropdownMenu>

          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="relative font-display text-sm font-semibold uppercase tracking-[0.14em] text-foreground/80 hover:text-primary transition-colors after:content-[''] after:absolute after:left-0 after:bottom-[-6px] after:h-[2px] after:w-0 after:bg-gradient-cyber after:transition-all hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Country selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Cambiar país" className="text-lg">
                {COUNTRY_FLAGS[country].flag}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-border min-w-[180px]">
              {(Object.entries(COUNTRY_FLAGS) as [CountryCode, { flag: string; label: string }][]).map(([code, { flag, label }]) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => setCountry(code)}
                  className={`font-display text-sm ${country === code ? "text-primary font-bold" : ""}`}
                >
                  <span className="mr-2">{flag}</span>{label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" asChild>
            <Link to="/catalogo" aria-label="Buscar"><Search className="h-5 w-5" /></Link>
          </Button>

          <Button variant="ghost" size="icon" asChild className="relative">
            <Link to="/carrito" aria-label="Carrito">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-gradient-cyber text-white text-[10px] font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1 animate-scale-in shadow-[0_0_10px_hsl(var(--primary))]">
                  {itemCount}
                </span>
              )}
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><User className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                <DropdownMenuItem asChild><Link to="/cuenta">Mi cuenta</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/cuenta/pedidos">Mis pedidos</Link></DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="text-secondary"><Shield className="mr-2 h-4 w-4" />Panel admin</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="neon" size="sm" asChild className="hidden sm:inline-flex font-display tracking-[0.12em] uppercase">
              <Link to="/auth">Ingresar</Link>
            </Button>
          )}

          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-card/95 backdrop-blur-xl animate-fade-in">
          <nav className="container flex flex-col py-4 gap-1">
            <p className="py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground font-display">Catálogo</p>
            {catalogSubLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setOpen(false)}
                className="py-2 pl-4 font-display text-sm font-semibold uppercase tracking-[0.14em] text-foreground/80 hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="h-px bg-border/40 my-2" />
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setOpen(false)}
                className="py-2.5 font-display text-sm font-semibold uppercase tracking-[0.14em] text-foreground/80 hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {!user && (
              <Button variant="neon" size="sm" asChild className="mt-2 w-full">
                <Link to="/auth" onClick={() => setOpen(false)}>Ingresar</Link>
              </Button>
            )}
            <div className="h-px bg-border/40 my-2" />
            <p className="py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground font-display">Moneda</p>
            <div className="flex gap-2 pl-4">
              {(Object.entries(COUNTRY_FLAGS) as [CountryCode, { flag: string; label: string }][]).map(([code, { flag, label }]) => (
                <Button
                  key={code}
                  variant={country === code ? "neon" : "ghost"}
                  size="sm"
                  onClick={() => { setCountry(code); setOpen(false); }}
                  className="text-lg px-2"
                  aria-label={label}
                >
                  {flag}
                </Button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
