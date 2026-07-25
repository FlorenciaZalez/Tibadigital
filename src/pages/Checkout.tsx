import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Banknote, Bitcoin, Shield, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getPricePresentation } from "@/lib/currency";
import { toast } from "sonner";

const PAYMENT_METHODS = [
  { id: "mercadopago", label: "MercadoPago", Icon: CreditCard, desc: "Verificación automática" },
  { id: "transferencia", label: "Transferencia", Icon: Banknote, desc: "Aprobación manual" },
  { id: "binance", label: "Binance / Cripto", Icon: Bitcoin, desc: "Checkout oficial + webhook" },
];

const Checkout = () => {
  const { items, total, refresh: refreshCart } = useCart();
  const { user, country } = useAuth();
  const navigate = useNavigate();
  const [method, setMethod] = useState("mercadopago");
  const [whatsapp, setWhatsapp] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!user) { navigate("/auth"); return null; }
  if (items.length === 0) { navigate("/carrito"); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data: order, error } = await supabase.rpc("create_checkout_order", {
      _payment_method: method,
      _whatsapp: whatsapp || null,
      _notes: notes || null,
    });

    if (error || !order) {
      const message = error?.message?.includes("insufficient stock")
        ? "El stock cambió mientras comprabas. Revisá el carrito e intentá nuevamente."
        : "No pudimos crear el pedido de forma segura.";
      toast.error(message);
      setSubmitting(false);
      return;
    }
    await refreshCart();

    if (method === "mercadopago") {
      window.open(`/checkout/mercadopago/${order.id}`, "_blank", "noopener,noreferrer");
      toast.success("Pedido creado", { description: "Abrimos Mercado Pago en una nueva pestaña para que no salgas de la web." });
      navigate(`/cuenta/pedidos`);
      setSubmitting(false);
      return;
    }

    if (method === "binance") {
      window.open(`/checkout/binance/${order.id}`, "_blank", "noopener,noreferrer");
      toast.success("Pedido creado", { description: "Abrimos Binance Pay en una nueva pestaña para que completes el pago sin salir de la web." });
      navigate(`/cuenta/pedidos`);
      setSubmitting(false);
      return;
    }

    const exactAmountView = getPricePresentation(Number(order.exact_amount), country);
    toast.success("¡Pedido creado!", { description: `Pagá exactamente ${exactAmountView.primary}${exactAmountView.secondary ? ` (${exactAmountView.secondary})` : ""} y subí el comprobante.` });
    navigate(`/cuenta/pedidos`);
    setSubmitting(false);
  };

  const totalView = getPricePresentation(total, country);

  return (
    <div className="container py-10">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
        <ChevronLeft />Volver
      </Button>

      <h1 className="font-display font-black text-4xl md:text-5xl mb-8">
        FINALIZAR <span className="text-gradient-neon">COMPRA</span>
      </h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Contact */}
          <section className="card-cyber p-6 rounded-xl space-y-4">
            <h2 className="font-display font-bold text-lg uppercase tracking-wider flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm">1</span>
              Datos de contacto
            </h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="whatsapp">WhatsApp (recomendado)</Label>
                <Input id="whatsapp" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+54 9 11 1234 5678" className="bg-input mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Te enviamos las credenciales del juego también por WhatsApp.</p>
              </div>
              <div>
                <Label htmlFor="notes">Notas adicionales (opcional)</Label>
                <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Instrucciones extra" className="bg-input mt-1" />
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="card-cyber p-6 rounded-xl space-y-4">
            <h2 className="font-display font-bold text-lg uppercase tracking-wider flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm">2</span>
              Método de pago
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PAYMENT_METHODS.map(({ id, label, Icon, desc }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setMethod(id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${method === id ? "border-primary bg-primary/5 shadow-[0_0_20px_hsl(var(--primary)/0.3)]" : "border-border hover:border-primary/50"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Icon className="h-6 w-6 text-secondary" />
                    {method === id && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="font-display font-bold text-sm">{label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{desc}</div>
                </button>
              ))}
            </div>
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <p className="text-sm font-display font-bold text-secondary">⚡ Cómo funciona</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Confirmás el pedido y se genera un <b>monto exacto único</b> con centavos.</li>
                <li>Mercado Pago y Binance Pay abren su checkout oficial; transferencia sigue con comprobante manual.</li>
                <li>Si elegís transferencia, subís el comprobante en "Mis pedidos".</li>
                <li>Cuando el pago queda acreditado, el sistema entrega tus credenciales por <b>email y WhatsApp</b>.</li>
              </ol>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 h-fit space-y-3">
          <div className="card-cyber p-6 rounded-xl space-y-3">
            <h2 className="font-display font-bold uppercase tracking-wider">Tu pedido</h2>
            <div className="space-y-2 text-sm max-h-60 overflow-y-auto">
              {items.map((i) => {
                const itemView = getPricePresentation(Number(i.product.discount_price ?? i.product.price) * i.quantity, country);
                return (
                  <div key={i.id} className="flex justify-between gap-2">
                    <span className="text-muted-foreground line-clamp-1">{i.quantity}× {i.product.title}</span>
                    <span className="font-semibold shrink-0">{itemView.primary}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between items-baseline gap-3">
              <span className="font-display font-bold uppercase tracking-wider">Total</span>
              <div className="text-right">
                <span className="font-display font-black text-2xl text-gradient-neon">{totalView.primary}</span>
                {totalView.secondary && <div className="text-[11px] text-muted-foreground">{totalView.secondary}</div>}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              ⚠️ Al confirmar, se generará un <b>monto exacto con centavos únicos</b> (ej: $15.003) que vas a tener que pagar para que el sistema identifique tu pago automáticamente.
            </p>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Procesando..." : "Confirmar pedido"}
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
};

export default Checkout;
