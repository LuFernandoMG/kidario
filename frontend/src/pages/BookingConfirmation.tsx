import { Link, useParams } from "react-router-dom";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { getStoredBookingById } from "@/lib/bookingsStorage";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";

export default function BookingConfirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const booking = bookingId ? getStoredBookingById(bookingId) : undefined;

  if (!booking) {
    return (
      <AppShell hideNav>
        <TopBar title="Confirmacao" showBack />
        <div className="px-4 pt-10">
          <div className="card-kidario p-6 text-center">
            <p className="text-foreground font-medium">Nao encontramos os dados da reserva.</p>
            <Link to="/agenda" className="text-primary text-sm font-medium hover:underline mt-3 inline-block">
              Ir para agenda
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const isPending = booking.status === "pendente";

  return (
    <AppShell hideNav>
      <TopBar title="Confirmacao" />

      <div className="px-4 pt-8 pb-8 space-y-6">
        <section className="card-kidario p-5 text-center">
          <div className="w-14 h-14 rounded-full bg-success/10 mx-auto flex items-center justify-center">
            {isPending ? (
              <LoaderCircle className="w-7 h-7 text-warning" />
            ) : (
              <CheckCircle2 className="w-7 h-7 text-success" />
            )}
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground mt-4">
            {isPending ? "Reserva pendente" : "Aula agendada"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isPending
              ? "Recebemos seu pedido. Assim que o pagamento for confirmado, sua aula sera confirmada."
              : "Seu agendamento foi concluido com sucesso."}
          </p>
        </section>

        <BookingSummaryCard
          title="Detalhes"
          rows={[
            { label: "Professora:", value: booking.teacherName },
            { label: "Especialidade:", value: booking.specialty },
            { label: "Data:", value: booking.dateLabel },
            { label: "Horario:", value: booking.time },
            { label: "Modalidade:", value: booking.modality === "online" ? "Online" : "Presencial" },
            { label: "Status:", value: booking.status === "confirmada" ? "Confirmada" : "Pendente" },
          ]}
        />

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
