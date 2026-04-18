import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type UiState = "loading" | "approved" | "pending" | "failed";

const MercadoPagoResult = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<UiState>("loading");
  const [message, setMessage] = useState("Confirmando tu pago...");

  useEffect(() => {
    document.title = "Resultado de pago | TIBADIGITAL";

    const orderId = params.get("order_id") || params.get("external_reference");
    const paymentId = params.get("payment_id") || params.get("collection_id");
    const status = params.get("status");

    if (!orderId) {
      setState("failed");
      setMessage("No encontramos la orden asociada a este pago.");
      return;
    }

    if (!paymentId) {
      if (status === "pending" || status === "in_process") {
        setState("pending");
        setMessage("Tu pago quedo pendiente. Cuando Mercado Pago lo confirme, vas a verlo en tus pedidos.");
        return;
      }

      setState("failed");
      setMessage("El pago no se completo o fue cancelado.");
      return;
    }

    const confirmPayment = async () => {
      const { data, error } = await supabase.functions.invoke("confirm-mercadopago-payment", {
        body: { order_id: orderId, payment_id: paymentId },
      });

      if (error) {
        setState("failed");
        setMessage(error.message || "No pudimos validar el pago con Mercado Pago.");
        return;
      }

      if (data?.status === "approved") {
        setState("approved");
        setMessage("Pago aprobado. Estamos entregando tu pedido.");
        toast.success("Pago aprobado");
        return;
      }

      if (data?.status === "pending") {
        setState("pending");
        setMessage("Tu pago esta pendiente. Te avisamos cuando quede acreditado.");
        return;
      }

      setState("failed");
      setMessage("Mercado Pago no devolvio un pago aprobado para esta compra.");
    };

    void confirmPayment();
  }, [navigate, params]);

  return (
    <div className="container py-14 max-w-3xl">
      <div className="card-cyber rounded-xl p-8 text-center space-y-5">
        {state === "loading" && <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />}
        {state === "approved" && <CheckCircle2 className="h-10 w-10 mx-auto text-success" />}
        {state === "failed" && <XCircle className="h-10 w-10 mx-auto text-destructive" />}
        {state === "pending" && <Loader2 className="h-8 w-8 mx-auto animate-spin text-warning" />}

        <h1 className="font-display font-black text-3xl">
          {state === "approved" ? "Pago aprobado" : state === "pending" ? "Pago pendiente" : state === "loading" ? "Validando pago" : "Pago no confirmado"}
        </h1>
        <p className="text-muted-foreground">{message}</p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button asChild variant="hero"><Link to="/cuenta/pedidos">Ir a mis pedidos</Link></Button>
          {state !== "approved" && (
            <Button asChild variant="outline"><Link to="/catalogo">Volver al catalogo</Link></Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MercadoPagoResult;