import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { PaymentInstructionsCard } from "@/components/booking/PaymentInstructionsCard";
import { getBookingDetail, type BookingDetailResponse } from "@/data/api/bookings";
import { getSupabaseAccessToken } from "@/lib/authSession";

export default function BookingConfirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const accessToken = getSupabaseAccessToken();
    if (!bookingId || !accessToken) {
      setError("Não encontramos os dados da reserva.");
      return;
    }

    let isMounted = true;
    getBookingDetail(accessToken, bookingId)
      .then((payload) => {
        if (!isMounted) return;
        setBooking(payload);
        setError("");
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setError(loadError instanceof Error ? loadError.message : "Não encontramos os dados da reserva.");
      });

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  if (!booking) {
    return (
      <AppShell hideNav>
        <TopBar title="Confirmação" showBack />
        <div className="px-4 pt-10">
          <div className="card-kidario p-6 text-center">
            <p className="text-foreground font-medium">{error || "Carregando reserva..."}</p>
            {error && (
              <Link to="/agenda" className="text-primary text-sm font-medium hover:underline mt-3 inline-block">
                Ir para agenda
              </Link>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  const paymentCharge = booking.payment_order?.charges?.[0];
  const statusCopy = getBookingPaymentCopy(booking);

  return (
    <AppShell hideNav>
      <TopBar title="Confirmação" />

      <div className="px-4 pt-8 pb-8 space-y-6">
        <section className="card-kidario p-5 text-center">
          <div className="w-14 h-14 rounded-full bg-success/10 mx-auto flex items-center justify-center">
            {booking.status === "pendente" ? (
              <LoaderCircle className="w-7 h-7 text-warning" />
            ) : (
              <CheckCircle2 className="w-7 h-7 text-success" />
            )}
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground mt-4">
            {statusCopy.title}
          </h1>
          <p className="text-muted-foreground mt-2">{statusCopy.description}</p>
        </section>

        <BookingSummaryCard
          title="Detalhes"
          rows={[
            { label: "Professora:", value: booking.teacher_name },
            { label: "Aluno:", value: booking.child_name },
            { label: "Data:", value: booking.date_label },
            { label: "Horário:", value: booking.time },
            { label: "Modalidade:", value: booking.modality === "online" ? "Online" : "Presencial" },
            { label: "Professora:", value: decisionStatusLabel(booking.teacher_decision_status) },
            { label: "Pagamento:", value: paymentStatusLabel(booking.payment_flow_status) },
          ]}
        />

        <PaymentInstructionsCard paymentOrder={booking.payment_order} paymentCharge={paymentCharge} />

        <div className="space-y-3">
          <KidarioButton asChild variant="hero" size="xl" fullWidth>
            <Link to="/agenda">Ver minha agenda</Link>
          </KidarioButton>
          <KidarioButton asChild variant="outline" size="xl" fullWidth>
            <Link to="/explorar">Explorar mais professoras</Link>
          </KidarioButton>
        </div>
      </div>
    </AppShell>
  );
}

function decisionStatusLabel(status?: string) {
  if (status === "accepted") return "Aceita";
  if (status === "rejected") return "Horário recusado";
  return "Aguardando";
}

function paymentStatusLabel(status?: string) {
  if (status === "paid") return "Pago";
  if (status === "authorized") return "Autorizado";
  if (status === "awaiting_payment") return "Aguardando pagamento";
  if (status === "failed") return "Falhou";
  if (status === "expired") return "Expirado";
  return "Não iniciado";
}

function getBookingPaymentCopy(booking: BookingDetailResponse) {
  if (booking.status === "confirmada") {
    return {
      title: "Aula agendada",
      description: "Pagamento confirmado e horário aceito pela professora.",
    };
  }
  if (booking.teacher_decision_status === "rejected") {
    return {
      title: "Horário em renegociação",
      description: "A professora não pode neste horário. Use o chat para definir uma nova opção.",
    };
  }
  if (booking.payment_flow_status === "authorized") {
    return {
      title: "Cartão autorizado",
      description: "A cobrança será capturada somente se a professora aceitar o horário.",
    };
  }
  if (booking.payment_flow_status === "awaiting_payment") {
    return {
      title: "Pagamento pendente",
      description: "Conclua o pagamento para confirmar a aula.",
    };
  }
  return {
    title: "Reserva pendente",
    description: "Recebemos sua solicitação e estamos aguardando a professora.",
  };
}
