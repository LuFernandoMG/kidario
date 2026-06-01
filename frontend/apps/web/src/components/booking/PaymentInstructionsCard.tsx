import { useState } from "react";
import { Barcode, Clock, Copy, ExternalLink, QrCode } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import type { PaymentCharge, PaymentOrder } from "@/data/api/bookings";

interface PaymentInstructionsCardProps {
  paymentOrder?: PaymentOrder | null;
  paymentCharge?: PaymentCharge | null;
  subjectLabel?: string;
}

export function PaymentInstructionsCard({
  paymentOrder,
  paymentCharge,
  subjectLabel = "aula",
}: PaymentInstructionsCardProps) {
  const [copiedValue, setCopiedValue] = useState("");
  if (!paymentCharge) return null;

  const paymentMethod = paymentCharge.payment_method;
  const isPix = paymentMethod === "pix";
  const isBoleto = paymentMethod === "boleto";
  if (!isPix && !isBoleto) return null;
  const confirmationCopy =
    subjectLabel === "pacote"
      ? "O pacote será confirmado quando o pagamento for compensado."
      : "A aula será confirmada quando o pagamento for compensado.";

  const copyValue = isPix ? paymentCharge.pix_qr_code : paymentCharge.boleto_line;
  const paymentUrl = paymentCharge.payment_url || paymentCharge.boleto_url || "";
  const deadline = paymentCharge.expires_at || paymentOrder?.expires_at || null;
  const hasContent = Boolean(
    paymentCharge.pix_qr_code_url
      || copyValue
      || paymentUrl
      || deadline,
  );
  if (!hasContent) return null;

  const handleCopy = async () => {
    if (!copyValue || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopiedValue(copyValue);
      window.setTimeout(() => setCopiedValue(""), 1800);
    } catch {
      setCopiedValue("");
    }
  };

  return (
    <section className="card-kidario p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {isPix ? <QrCode className="w-5 h-5" /> : <Barcode className="w-5 h-5" />}
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {isPix ? "Pague com Pix" : "Pague com boleto"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isPix
              ? `Use o QR Code ou copie o código Pix. ${confirmationCopy}`
              : `Use a linha digitável ou abra o boleto. ${confirmationCopy}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">
        <Clock className="w-4 h-4 text-primary shrink-0" />
        <span>{formatDeadlineCopy(paymentMethod, deadline)}</span>
      </div>

      {isPix && paymentCharge.pix_qr_code_url && (
        <div className="flex justify-center rounded-lg border border-border bg-white p-4">
          <img
            src={paymentCharge.pix_qr_code_url}
            alt="QR Code Pix"
            className="w-48 h-48 max-w-full object-contain"
          />
        </div>
      )}

      {copyValue && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isPix ? "Código Pix copia e cola" : "Linha digitável"}
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground break-all">
            {copyValue}
          </div>
          <KidarioButton type="button" variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="w-4 h-4" />
            {copiedValue === copyValue ? "Copiado" : "Copiar"}
          </KidarioButton>
        </div>
      )}

      {paymentUrl && (
        <KidarioButton asChild variant="hero" size="lg" fullWidth>
          <a href={paymentUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="w-4 h-4" />
            {isPix ? "Abrir pagamento" : "Abrir boleto"}
          </a>
        </KidarioButton>
      )}
    </section>
  );
}

function formatDeadlineCopy(paymentMethod: PaymentCharge["payment_method"], deadline: string | null) {
  if (deadline) {
    const parsedDate = new Date(deadline);
    if (!Number.isNaN(parsedDate.getTime())) {
      const formattedDeadline = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsedDate);
      return `Pague até ${formattedDeadline}.`;
    }
  }

  if (paymentMethod === "pix") {
    return "O Pix expira 24 horas após a geração.";
  }
  return "O boleto vence em até 3 dias após a geração.";
}
