import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, ChevronLeft, ShoppingBag, Upload, KeyRound, Copy, Loader2, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { stripSourceMetadata } from "@/lib/sourceMetadata";
import { toast } from "sonner";

interface DeliveredKey {
  id: string;
  key_type: string;
  content: string;
  notes: string | null;
  reserved_for_order_id: string | null;
}

interface Order {
  id: string;
  public_code: string | null;
  created_at: string;
  status: string;
  total: number;
  exact_amount: number | null;
  payment_method: string | null;
  payment_proof_url: string | null;
  verification_status: string;
  verification_notes: string | null;
  whatsapp: string | null;
  order_items: { product_id: string; product_title: string; quantity: number; unit_price: number }[];
}

const formatPrice = (n: number, decimals = 0) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/20 text-warning border-warning/40",
  paid: "bg-success/20 text-success border-success/40",
  shipped: "bg-secondary/20 text-secondary border-secondary/40",
  delivered: "bg-primary/20 text-primary border-primary/40",
  cancelled: "bg-destructive/20 text-destructive border-destructive/40",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente de pago",
  paid: "Pagado",
  shipped: "Enviado",
  delivered: "Entregado ✨",
  cancelled: "Cancelado",
};

const VS_LABELS: Record<string, { label: string; color: string }> = {
  not_submitted: { label: "Esperando comprobante", color: "text-muted-foreground" },
  awaiting_verification: { label: "🔍 Verificando pago...", color: "text-warning" },
  verified: { label: "✓ Pago verificado", color: "text-success" },
  rejected: { label: "✗ Rechazado", color: "text-destructive" },
  manual_review: { label: "⏳ En revisión manual", color: "text-secondary" },
};

const MisPedidos = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [keys, setKeys] = useState<DeliveredKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [verifyingFor, setVerifyingFor] = useState<string | null>(null);
  const [retryingFor, setRetryingFor] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Mis pedidos | TIBADIGITAL";
    if (user) refresh();
  }, [user]);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: ords }, { data: ks }] = await Promise.all([
      supabase.from("orders").select("*, order_items(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("product_keys").select("id, key_type, content, notes, reserved_for_order_id")
        .eq("delivered_to_user_id", user.id).eq("status", "delivered"),
    ]);
    if (ords) setOrders(ords as any);
    if (ks) setKeys(ks as any);
    setLoading(false);
  };

  const uploadProof = async (orderId: string, file: File) => {
    if (!user) return;
    setUploadingFor(orderId);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${orderId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("payment-proofs").upload(path, file, { upsert: false });
    if (error) {
      toast.error("Error al subir: " + error.message);
      setUploadingFor(null);
      return;
    }
    await supabase.from("orders").update({
      payment_proof_url: path,
      proof_submitted_at: new Date().toISOString(),
      verification_status: "awaiting_verification",
    }).eq("id", orderId);

    toast.success("Comprobante subido. Verificando pago...");
    setUploadingFor(null);

    // Disparar verificación
    setVerifyingFor(orderId);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("verify-payment", {
        body: { order_id: orderId },
      });
      if (fnErr) throw fnErr;
      if (data?.status === "verified") {
        toast.success("¡Pago verificado! Tus credenciales ya están en camino.");
      } else if (data?.status === "manual_review") {
        toast.info("Pago en revisión manual. Te notificamos en breve.");
      }
    } catch (e: any) {
      toast.error("Error al verificar: " + e.message);
    }
    setVerifyingFor(null);
    refresh();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado");
  };

  const retryDelivery = async (orderId: string) => {
    setRetryingFor(orderId);
    try {
      const { data, error } = await supabase.functions.invoke("retry-delivery", {
        body: { order_id: orderId },
      });

      if (error) throw error;
      if (data?.ok === false) throw new Error(data.error);
      if (data?.error) throw new Error(data.error);

      toast.success(data?.already_delivered ? "Ese pedido ya estaba entregado" : "Entrega reintentada con éxito");
      await refresh();
    } catch (e: any) {
      toast.error(`No pudimos reintentar la entrega: ${e.message}`);
    }
    setRetryingFor(null);
  };

  return (
    <div className="container py-12 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/cuenta"><ChevronLeft />Mi cuenta</Link>
      </Button>

      <h1 className="font-display font-black text-3xl md:text-5xl mb-8">
        MIS <span className="text-gradient-neon">PEDIDOS</span>
      </h1>

      {loading ? (
        <div className="text-center text-muted-foreground py-20">Cargando...</div>
      ) : orders.length === 0 ? (
        <div className="card-cyber rounded-2xl p-10 text-center space-y-4">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
          <h2 className="font-display font-bold text-xl">Aún no tenés pedidos</h2>
          <p className="text-muted-foreground">Empezá a explorar el catálogo y armá tu primer pedido.</p>
          <Button variant="hero" asChild><Link to="/catalogo">Ver catálogo</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const orderKeys = keys.filter((k) => k.reserved_for_order_id === order.id);
            const vs = VS_LABELS[order.verification_status] || VS_LABELS.not_submitted;
            const isMercadoPagoPending = order.payment_method === "mercadopago" && ["pending"].includes(order.status) && order.verification_status !== "verified";
            const needsProof = ["pending"].includes(order.status) && order.verification_status === "not_submitted" && order.payment_method !== "mercadopago";
            const verifying = verifyingFor === order.id;
            const uploading = uploadingFor === order.id;
            const retrying = retryingFor === order.id;
            const needsDeliveryRetry = order.verification_status === "verified" && order.status === "paid" && orderKeys.length === 0;

            return (
              <div key={order.id} className="card-cyber rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-secondary" />
                      <span className="font-display font-bold text-sm uppercase tracking-wider">
                        {order.public_code || `#${order.id.slice(0, 8)}`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                      {order.payment_method && ` · ${order.payment_method}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-[10px] font-display font-bold tracking-wider rounded border uppercase ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div className="border-t border-border pt-3 space-y-1">
                  {order.order_items?.map((item, i) => (
                    <div key={i} className="text-sm flex justify-between text-muted-foreground">
                      <span>{item.quantity}× {item.product_title}</span>
                      <span>{formatPrice(Number(item.unit_price) * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {/* Monto exacto + comprobante */}
                {needsProof && (
                  <div className="bg-warning/10 border border-warning/40 rounded-lg p-4 space-y-3">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-warning font-display">⚡ Monto exacto a pagar</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-display font-black text-3xl text-gradient-neon">
                          {formatPrice(Number(order.exact_amount), 2)}
                        </span>
                        <Button size="icon" variant="ghost" onClick={() => copy(String(order.exact_amount))}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Pagá <b>exactamente</b> este monto (incluyendo los centavos) desde tu {order.payment_method}, después subí el comprobante acá abajo.
                      </p>
                    </div>
                    <label className="block">
                      <input
                        type="file" accept="image/*,.pdf" hidden
                        onChange={(e) => e.target.files?.[0] && uploadProof(order.id, e.target.files[0])}
                        disabled={uploading}
                      />
                      <Button asChild variant="hero" size="lg" className="w-full cursor-pointer" disabled={uploading}>
                        <span>
                          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Subiendo...</> : <><Upload className="h-4 w-4" />Subir comprobante</>}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}

                {isMercadoPagoPending && (
                  <div className="bg-primary/10 border border-primary/40 rounded-lg p-4 space-y-3">
                    <div>
                      <div className="text-xs uppercase tracking-widest text-primary font-display">Mercado Pago</div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Este pedido se paga directo con Mercado Pago. Si cerraste la ventana o queres retomarlo, continua desde aca.
                      </p>
                    </div>
                    <Button asChild variant="hero" size="lg" className="w-full">
                      <Link to={`/checkout/mercadopago/${order.id}`}>
                        <CreditCard className="h-4 w-4" />Continuar pago con Mercado Pago
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Estado de verificación */}
                {order.verification_status !== "not_submitted" && (
                  <div className="border-t border-border pt-3">
                    <div className={`flex items-center gap-2 text-sm font-display ${vs.color}`}>
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : order.verification_status === "verified" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      {verifying ? "Verificando pago en MercadoPago..." : vs.label}
                    </div>
                    {order.verification_notes && !verifying && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{order.verification_notes}</p>
                    )}
                    {needsDeliveryRetry && (
                      <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 space-y-3">
                        <p className="text-sm text-warning font-display">Pago verificado, pero la entrega no terminó. Reintentá desde acá.</p>
                        <Button onClick={() => retryDelivery(order.id)} variant="outline" disabled={retrying}>
                          {retrying ? <><Loader2 className="h-4 w-4 animate-spin" />Reintentando entrega...</> : <><KeyRound className="h-4 w-4" />Reintentar entrega</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Keys entregadas */}
                {orderKeys.length > 0 && (
                  <div className="border-t border-primary/40 pt-3 space-y-2">
                    <div className="font-display font-bold text-sm flex items-center gap-2 text-primary">
                      <KeyRound className="h-4 w-4" />Tus credenciales
                    </div>
                    {orderKeys.map((k) => (
                      <div key={k.id} className="bg-primary/5 border border-primary/30 rounded-lg p-3 space-y-1">
                        <div className="text-xs font-display uppercase tracking-wider text-secondary">
                          {k.key_type === "code" ? "Codigo" : "Cuenta"}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm bg-background/50 px-2 py-1 rounded flex-1 whitespace-pre-line break-all">{k.content}</div>
                          <Button size="icon" variant="ghost" onClick={() => copy(k.content)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        {stripSourceMetadata(k.notes) && <p className="text-xs text-muted-foreground">{stripSourceMetadata(k.notes)}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MisPedidos;
