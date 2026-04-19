import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Eye, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminOrder {
  id: string;
  public_code: string;
  created_at: string;
  total: number;
  exact_amount: number;
  status: string;
  payment_method: string | null;
  verification_status: string;
  payment_proof_url: string | null;
  proof_submitted_at: string | null;
  verification_notes: string | null;
  user_id: string;
  whatsapp: string | null;
  shipping_address: string | null;
  order_items: { product_title: string; quantity: number; unit_price: number }[];
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n);

const VS_BADGE: Record<string, string> = {
  not_submitted: "bg-muted text-muted-foreground",
  awaiting_verification: "bg-warning/20 text-warning border-warning/40",
  verified: "bg-success/20 text-success border-success/40",
  rejected: "bg-destructive/20 text-destructive border-destructive/40",
  manual_review: "bg-secondary/20 text-secondary border-secondary/40",
};

const AdminPedidos = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Pedidos | Admin TIBADIGITAL";
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (data) setOrders(data as any);
    setLoading(false);
  };

  const getProofUrl = async (orderId: string, path: string) => {
    if (proofUrls[orderId]) return proofUrls[orderId];
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60 * 10);
    if (data) {
      setProofUrls((p) => ({ ...p, [orderId]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  };

  const approveManually = async (order: AdminOrder) => {
    if (!confirm(`Aprobar manualmente el pedido ${order.public_code} y entregar las keys?`)) return;
    const { data, error: fnError } = await supabase.functions.invoke("approve-order-admin", {
      body: { order_id: order.id },
    });

    if (!fnError && data?.ok) {
      toast.success(data?.already_delivered ? "Ese pedido ya estaba entregado" : "Pedido aprobado y entregado");
    } else {
      toast.error(data?.error || fnError?.message || "Pedido aprobado pero la entrega falló. Revisá manualmente.");
    }

    refresh();
  };

  const reject = async (order: AdminOrder) => {
    const reason = prompt("Motivo del rechazo:");
    if (!reason) return;
    await supabase.from("orders").update({
      verification_status: "rejected", status: "cancelled", verification_notes: reason,
    }).eq("id", order.id);
    toast.success("Pedido rechazado");
    refresh();
  };

  const pendingCount = orders.filter((o) => ["awaiting_verification", "manual_review"].includes(o.verification_status)).length;

  return (
    <div className="container py-10 max-w-6xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/admin"><ChevronLeft />Admin</Link>
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <h1 className="font-display font-black text-3xl md:text-4xl">
          PEDIDOS <span className="text-gradient-neon">/ PAGOS</span>
        </h1>
        {pendingCount > 0 && (
          <div className="px-3 py-1.5 rounded-md bg-warning/20 text-warning border border-warning/40 text-sm font-display">
            {pendingCount} pendiente{pendingCount > 1 ? "s" : ""} de revisión
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-20">Cargando...</div>
      ) : orders.length === 0 ? (
        <div className="card-cyber p-10 text-center text-muted-foreground rounded-xl">Sin pedidos aún</div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card-cyber rounded-xl p-5">
              <div className="flex items-start justify-between flex-wrap gap-4 mb-3">
                <div>
                  <div className="font-display font-bold text-lg">{o.public_code}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("es-AR")} · {o.payment_method}
                    {o.whatsapp && ` · WA: ${o.whatsapp}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display font-black text-xl text-gradient-neon">{formatPrice(Number(o.exact_amount || o.total))}</div>
                  <div className="text-[10px] text-muted-foreground">monto exacto a cobrar</div>
                </div>
              </div>

              <div className="space-y-1 text-sm border-t border-border pt-3 mb-3">
                {o.order_items.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-muted-foreground">
                    <span>{i.quantity}× {i.product_title}</span>
                    <span>{formatPrice(Number(i.unit_price) * i.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 rounded text-[10px] font-display tracking-wider border ${VS_BADGE[o.verification_status]}`}>
                    {o.verification_status.replace("_", " ").toUpperCase()}
                  </span>
                  <span className="px-2 py-1 rounded text-[10px] font-display tracking-wider bg-muted/40 text-muted-foreground">
                    {o.status.toUpperCase()}
                  </span>
                  {o.verification_notes && (
                    <span className="text-xs text-muted-foreground italic">— {o.verification_notes}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  {o.payment_proof_url && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      const url = await getProofUrl(o.id, o.payment_proof_url!);
                      if (url) window.open(url, "_blank");
                    }}>
                      <Eye className="h-4 w-4" />Ver comprobante
                    </Button>
                  )}
                  {["awaiting_verification", "manual_review", "not_submitted"].includes(o.verification_status) && o.status !== "delivered" && (
                    <>
                      <Button size="sm" variant="hero" onClick={() => approveManually(o)}>
                        <CheckCircle2 className="h-4 w-4" />Aprobar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reject(o)}>
                        <XCircle className="h-4 w-4" />Rechazar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPedidos;
