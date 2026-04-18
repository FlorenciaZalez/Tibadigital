import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrderData {
  id: string;
  total: number;
  status: string;
  payment_method: string | null;
  verification_status: string;
  public_code: string | null;
  order_items: { product_title: string; quantity: number; unit_price: number }[];
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n);

const MercadoPagoCheckout = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingPreference, setCreatingPreference] = useState(true);

  const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY as string | undefined;

  useEffect(() => {
    document.title = "Mercado Pago | TIBADIGITAL";
    if (publicKey) {
      initMercadoPago(publicKey, { locale: "es-AR" });
    }
  }, [publicKey]);

  useEffect(() => {
    if (!orderId) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, payment_method, verification_status, public_code, order_items(*)")
        .eq("id", orderId)
        .single();

      if (error || !data) {
        toast.error("No pudimos cargar el pedido");
        navigate("/cuenta/pedidos", { replace: true });
        return;
      }

      if (data.payment_method !== "mercadopago") {
        toast.error("Este pedido no usa Mercado Pago");
        navigate("/cuenta/pedidos", { replace: true });
        return;
      }

      setOrder(data as OrderData);
      setLoading(false);
    };

    void load();
  }, [navigate, orderId]);

  useEffect(() => {
    if (!orderId || !order || order.verification_status === "verified") {
      setCreatingPreference(false);
      return;
    }

    const createPreference = async () => {
      setCreatingPreference(true);
      const { data, error } = await supabase.functions.invoke("create-mercadopago-preference", {
        body: { order_id: orderId, site_url: window.location.origin },
      });

      if (error || !data?.preference_id) {
        toast.error("No pudimos iniciar Mercado Pago");
        setCreatingPreference(false);
        return;
      }

      setPreferenceId(data.preference_id);
      setCreatingPreference(false);
    };

    void createPreference();
  }, [order, orderId]);

  const totalItems = useMemo(() => order?.order_items ?? [], [order]);

  if (!publicKey) {
    return (
      <div className="container py-12 max-w-3xl">
        <div className="card-cyber rounded-xl p-8 text-center space-y-4">
          <h1 className="font-display font-black text-3xl">Mercado Pago no configurado</h1>
          <p className="text-muted-foreground">Falta la variable VITE_MERCADOPAGO_PUBLIC_KEY en el frontend.</p>
          <Button asChild variant="hero"><Link to="/cuenta/pedidos">Volver a mis pedidos</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-5xl">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link to="/cuenta/pedidos"><ChevronLeft />Mis pedidos</Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
        <section className="card-cyber rounded-xl p-6 space-y-5">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display">Pago seguro</div>
            <h1 className="font-display font-black text-3xl md:text-4xl">
              MERCADO <span className="text-gradient-neon">PAGO</span>
            </h1>
            <p className="text-muted-foreground">
              Vas a pagar dentro del flujo oficial de Mercado Pago y, cuando se apruebe, tu pedido se entrega automaticamente.
            </p>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm text-muted-foreground">
              Usa la interfaz oficial de Mercado Pago. No guardamos tarjetas en TIBADIGITAL.
            </div>
          </div>

          {loading || creatingPreference ? (
            <div className="rounded-xl border border-border p-8 text-center text-muted-foreground space-y-3">
              <Loader2 className="h-5 w-5 mx-auto animate-spin" />
              <div>Preparando tu pago...</div>
            </div>
          ) : order?.verification_status === "verified" ? (
            <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center space-y-3">
              <div className="font-display font-bold text-success">Este pedido ya fue pagado</div>
              <Button asChild variant="hero"><Link to="/cuenta/pedidos">Ver mis pedidos</Link></Button>
            </div>
          ) : preferenceId ? (
            <div className="rounded-xl border border-border p-4 bg-background/40">
              <Wallet
                initialization={{ preferenceId, redirectMode: "self" }}
                customization={{
                  theme: "dark",
                  customStyle: {
                    valuePropColor: "black",
                    buttonHeight: "56px",
                    borderRadius: "12px",
                  },
                }}
                locale="es-AR"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3">
              <div className="font-display font-bold">No pudimos generar la preferencia de pago</div>
              <Button onClick={() => window.location.reload()} variant="hero">Reintentar</Button>
            </div>
          )}
        </section>

        <aside className="card-cyber rounded-xl p-6 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-secondary font-display uppercase tracking-wider text-sm">
            <CreditCard className="h-4 w-4" />Resumen
          </div>
          <div className="text-sm text-muted-foreground">Pedido {order?.public_code || order?.id}</div>
          <div className="space-y-2 text-sm">
            {totalItems.map((item, idx) => (
              <div key={`${item.product_title}-${idx}`} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{item.quantity}× {item.product_title}</span>
                <span>{formatPrice(Number(item.unit_price) * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4 flex justify-between items-center">
            <span className="font-display uppercase tracking-wider">Total</span>
            <span className="font-display font-black text-2xl text-gradient-neon">{formatPrice(Number(order?.total || 0))}</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MercadoPagoCheckout;