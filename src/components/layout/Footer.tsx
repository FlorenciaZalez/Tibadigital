import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Instagram, Twitter, Youtube, Gamepad2 } from "lucide-react";

export const Footer = () => (
  <footer className="border-t border-border/40 bg-card/40 mt-20">
    <div className="container py-14 grid grid-cols-1 md:grid-cols-4 gap-10">
      <div className="space-y-4">
        <Logo />
        <p className="text-sm text-muted-foreground max-w-xs">
          La tienda gamer #1 en juegos de PlayStation. Calidad, velocidad y los mejores precios.
        </p>
        <div className="flex gap-3">
          {[Instagram, Twitter, Youtube, Gamepad2].map((Icon, i) => (
            <a key={i} href="#" className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary hover:shadow-[0_0_15px_hsl(var(--primary)/0.5)] transition-all">
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-display text-sm uppercase tracking-wider mb-4 text-secondary">Tienda</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><Link to="/catalogo" className="hover:text-primary transition-colors">Catálogo</Link></li>
          <li><Link to="/catalogo?platform=PS5" className="hover:text-primary transition-colors">PlayStation 5</Link></li>
          <li><Link to="/catalogo?platform=PS4" className="hover:text-primary transition-colors">PlayStation 4</Link></li>
          <li><Link to="/ofertas" className="hover:text-primary transition-colors">Ofertas</Link></li>
        </ul>
      </div>

      <div>
        <h4 className="font-display text-sm uppercase tracking-wider mb-4 text-secondary">Cuenta</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><Link to="/auth" className="hover:text-primary transition-colors">Iniciar sesión</Link></li>
          <li><Link to="/cuenta" className="hover:text-primary transition-colors">Mi cuenta</Link></li>
          <li><Link to="/cuenta/pedidos" className="hover:text-primary transition-colors">Mis pedidos</Link></li>
          <li><Link to="/carrito" className="hover:text-primary transition-colors">Carrito</Link></li>
        </ul>
      </div>

      <div>
        <h4 className="font-display text-sm uppercase tracking-wider mb-4 text-secondary">Soporte</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li><a href="#" className="hover:text-primary transition-colors">Preguntas frecuentes</a></li>

          <li><a href="#" className="hover:text-primary transition-colors">Contacto</a></li>
        </ul>
      </div>
    </div>

    <div className="border-t border-border/40">
      <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <p className="font-display tracking-widest text-gradient-neon">By</p>
          <a href="https://devertice.com" target="_blank" rel="noopener noreferrer">
            <img src="/devertice2.svg" alt="icono de DEVERTICE" className="h-15 w-15" />
          </a>
        </div>
        <p>© {new Date().getFullYear()} TIBADIGITAL. Todos los derechos reservados.</p>
      </div>
    </div>
  </footer>
);
