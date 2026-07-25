import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ExternalLink, Loader2, QrCode, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BinanceOrderMeta {
  provider: "binance_pay";
  merchantTradeNo: string;
  prepayId: string;
  checkoutUrl: string;
  deeplink: string | null;
  universalUrl: string | null;
  qrcodeLink: string | null;
  qrContent: string | null;
  expireTime: number;
  status: string;
  orderAmount: string;
  currency: string;
  fiatAmount: string | null;
  fiatCurrency: string | null;
  transactionId: string | null;
}

interface OrderData {
  id: string;
  total: number;
  exact_amount: number | null;
  status: string;
  payment_method: string | null;
  verification_status: string;
  verification_notes: string | null;
  public_code: string | null;
  payment_provider_meta: BinanceOrderMeta | null;
  order_items: { product_title: string; quantity: number; unit_price: number }[];
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n);

const BinanceCheckout = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [providerMeta, setProviderMeta] = useState<BinanceOrderMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(true);

  const returnedFromProvider = params.get("returned") === "1";

  const loadOrder = async () => {
    if (!orderId) return null;

    const { data, error } = await supabase
      .from("orders")
      .select("id, total, exact_amount, status, payment_method, verification_status, verification_notes, public_code, payment_provider_meta, order_items(*)")
      .eq("id", orderId)
      .single();

    if (error || !data) {
      toast.error("No pudimos cargar el pedido");
      navigate("/cuenta/pedidos", { replace: true });
      return null;
    }

    if (data.payment_method !== "binance") {
      toast.error("Este pedido no usa Binance Pay");
      navigate("/cuenta/pedidos", { replace: true });
      return null;
    }

    const typed = data as unknown as OrderData;
    setOrder(typed);
    setProviderMeta(typed.payment_provider_meta);
    return typed;
  };

  const createOrRefreshOrder = async () => {
    if (!orderId) return;

    setCreatingOrder(true);
    const { data, error } = await supabase.functions.invoke("create-binance-order", {
      body: { order_id: orderId, site_url: window.location.origin },
    });

    if (error || !data) {
      toast.error(error?.message || "No pudimos iniciar Binance Pay");
      setCreatingOrder(false);
      return;
    }

    if (data?.order_meta) {
      setProviderMeta(data.order_meta as BinanceOrderMeta);
    }

    const refreshedOrder = await loadOrder();
    if (refreshedOrder?.verification_status === "verified") {
      toast.success("Pago confirmado");
    }

    setCreatingOrder(false);
  };

  useEffect(() => {
    document.title = "Binance Pay | TIBADIGITAL";

    const boot = async () => {
      setLoading(true);
      const loaded = await loadOrder();
      setLoading(false);

      if (!loaded) return;
      if (loaded.verification_status === "verified") {
        setCreatingOrder(false);
        return;
      }

      await createOrRefreshOrder();
    };

    void boot();
  }, [navigate, orderId]);

  useEffect(() => {
    if (!orderId) return;

    const interval = window.setInterval(async () => {
      const refreshed = await loadOrder();
      if (refreshed?.verification_status === "verified") {
        window.clearInterval(interval);
      }
    }, returnedFromProvider ? 2500 : 5000);

    return () => window.clearInterval(interval);
  }, [orderId, returnedFromProvider]);

  const expiresInMinutes = useMemo(() => {
    if (!providerMeta?.expireTime) return null;
    const diffMs = providerMeta.expireTime - Date.now();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / 60000);
  }, [providerMeta]);

  const checkoutLink = providerMeta?.universalUrl || providerMeta?.checkoutUrl || providerMeta?.deeplink || null;
  const isPaid = order?.verification_status === "verified";
  const isExpired = Boolean(providerMeta?.expireTime && providerMeta.expireTime <= Date.now());

  if (loading) {
    return (
      <div className="container py-12 max-w-3xl">
        <div className="card-cyber rounded-xl p-8 text-center space-y-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 mx-auto animate-spin" />
          <div>Cargando checkout Binance Pay...</div>
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
            <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display">Pago cripto seguro</div>
            <h1 className="font-display font-black text-3xl md:text-4xl">
              BINANCE <span className="text-gradient-neon">PAY</span>
            </h1>
            <p className="text-muted-foreground">
              Vas a pagar con el checkout oficial de Binance Pay. Cuando el webhook confirme el pago, tu pedido se entrega automaticamente.
            </p>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm text-muted-foreground">
              No dependemos de comprobantes manuales. El pedido queda atado a tu orden y se acredita por webhook firmado.
            </div>
          </div>

          {creatingOrder ? (
            <div className="rounded-xl border border-border p-8 text-center text-muted-foreground space-y-3">
              <Loader2 className="h-5 w-5 mx-auto animate-spin" />
              <div>Preparando tu checkout Binance Pay...</div>
            </div>
          ) : isPaid ? (
            <div className="rounded-xl border border-success/30 bg-success/10 p-6 text-center space-y-3">
              <div className="font-display font-bold text-success">Este pedido ya fue pagado</div>
              <p className="text-sm text-muted-foreground">{order?.verification_notes || "Tu pedido quedó acreditado en Binance Pay."}</p>
              <Button asChild variant="hero" className="w-full"><Link to="/cuenta/pedidos">Ver mis pedidos</Link></Button>
            </div>
          ) : providerMeta ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 items-center rounded-xl border border-border bg-background/40 p-4">
                <div className="aspect-square rounded-xl border border-border bg-white p-3 flex items-center justify-center overflow-hidden">
                  {providerMeta.qrcodeLink ? (
                    <img src={providerMeta.qrcodeLink} alt="QR Binance Pay" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-secondary font-display">Monto en cripto</div>
                    <div className="font-display font-black text-3xl text-gradient-neon mt-1">
                      {providerMeta.orderAmount} {providerMeta.currency}
                    </div>
                    {providerMeta.fiatAmount && providerMeta.fiatCurrency && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Referencia interna: {providerMeta.fiatCurrency} {providerMeta.fiatAmount}
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>Estado Binance: <span className="text-foreground font-medium">{providerMeta.status}</span></div>
                    <div>Vence en: <span className="text-foreground font-medium">{expiresInMinutes === null ? "-" : expiresInMinutes === 0 ? "vencido" : `${expiresInMinutes} min`}</span></div>
                    <div>Referencia: <span className="font-mono text-xs">{providerMeta.merchantTradeNo}</span></div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {checkoutLink && (
                      <Button asChild variant="hero" className="w-full sm:w-auto">
                        <a href={checkoutLink} target="_blank" rel="noopener noreferrer">
                          <Wallet className="h-4 w-4" />Abrir Binance Pay
                        </a>
                      </Button>
                    )}
                    <Button onClick={() => void createOrRefreshOrder()} variant="outline" className="w-full sm:w-auto">
                      {isExpired ? "Generar nuevo checkout" : "Actualizar estado"}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Si pagaste y seguís viendo este estado, esperá unos segundos o tocá "Actualizar estado". Binance reintenta el webhook automáticamente.
                  </p>
                </div>
              </div>

              {returnedFromProvider && (
                <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm text-muted-foreground">
                  Volviste desde Binance. Estamos consultando el estado real del pago y de la entrega.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3">
              <div className="font-display font-bold">No pudimos generar el checkout de Binance Pay</div>
              <Button onClick={() => void createOrRefreshOrder()} variant="hero" className="w-full">Reintentar</Button>
            </div>
          )}
        </section>

        <aside className="card-cyber rounded-xl p-6 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-secondary font-display uppercase tracking-wider text-sm">
            <ExternalLink className="h-4 w-4" />Resumen
          </div>
          <div className="text-sm text-muted-foreground">Pedido {order?.public_code || order?.id}</div>
          <div className="space-y-2 text-sm">
            {(order?.order_items || []).map((item, idx) => (
              <div key={`${item.product_title}-${idx}`} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{item.quantity}× {item.product_title}</span>
                <span>{formatPrice(Number(item.unit_price) * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-4 flex justify-between items-center">
            <span className="font-display uppercase tracking-wider">Total</span>
            <span className="font-display font-black text-2xl text-gradient-neon">{formatPrice(Number(order?.exact_amount || order?.total || 0))}</span>
          </div>
          {order?.verification_notes && !isPaid && (
            <p className="text-xs text-muted-foreground leading-relaxed">{order.verification_notes}</p>
          )}
        </aside>
      </div>
    </div>
  );
};

export default BinanceCheckout;