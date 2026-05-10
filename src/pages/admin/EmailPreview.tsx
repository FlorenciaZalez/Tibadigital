import { Link } from "react-router-dom";
import { ChevronLeft, ExternalLink, Mail, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDeliveryEmailHtml, buildDeliveryEmailText, type DeliveryEmailTemplateData } from "../../../shared/deliveryEmailTemplate.ts";

const EmailPreview = () => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const previewData: DeliveryEmailTemplateData = {
    storeName: "TIBADIGITAL",
    logoUrl: origin ? `${origin}/logo.png` : null,
    orderCode: "TIBA-B3B5",
    createdAtLabel: "9 de mayo de 2026, 21:37",
    paymentMethodLabel: "mercadopago",
    totalLabel: "$ 4.000",
    customerName: "Florencia",
    itemsSummary: [
      {
        title: "FC 26 Standard Edition",
        quantity: 1,
        totalLabel: "$ 4.000",
      },
    ],
    deliveredItems: [
      {
        kind: "account",
        title: "FC 26 Standard Edition",
        fields: [
          { label: "Codigo", value: "TDP090" },
          { label: "Juego", value: "FC 26 Standard Edition" },
          { label: "Email", value: "hq2rpe@batica.com.ar" },
          { label: "Contrasena", value: "Duda3523" },
          { label: "Tipo", value: "PRIMARIA" },
          { label: "Consola", value: "PS4" },
        ],
        notes: "TDP090 | Primaria | PS4",
      },
    ],
  };

  const html = buildDeliveryEmailHtml(previewData);
  const text = buildDeliveryEmailText(previewData);

  const openHtmlInTab = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="container max-w-7xl py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin">
              <ChevronLeft className="h-4 w-4" />Volver al admin
            </Link>
          </Button>
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-secondary font-display">Preview de email</div>
            <h1 className="font-display font-black text-4xl md:text-5xl">
              MAIL DE <span className="text-gradient-neon">ENTREGA</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mt-3">
              Esta vista usa la misma plantilla que envia la Edge Function de entrega. Si retocas el template compartido, el preview y el email real cambian juntos.
            </p>
          </div>
        </div>

        <Button variant="hero" onClick={openHtmlInTab}>
          <ExternalLink className="h-4 w-4" />Abrir HTML en una pestaña
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <section className="card-cyber rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-display uppercase tracking-[0.25em] text-secondary">
            <MonitorSmartphone className="h-4 w-4" />Render HTML
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-background/80 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <iframe
              title="Preview del email de entrega"
              srcDoc={html}
              className="h-[900px] w-full bg-white"
            />
          </div>
        </section>

        <section className="card-cyber rounded-2xl p-4 md:p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-display uppercase tracking-[0.25em] text-secondary">
            <Mail className="h-4 w-4" />Version texto
          </div>
          <pre className="min-h-[900px] whitespace-pre-wrap rounded-2xl border border-border bg-muted/30 p-4 text-sm leading-7 text-foreground">
            {text}
          </pre>
        </section>
      </div>
    </div>
  );
};

export default EmailPreview;