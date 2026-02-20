import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calendar, Clock, MapPin, Video, FileText, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { TeacherBookingHeaderCard } from "@/components/booking/TeacherBookingHeaderCard";
import { BookingStatusPill } from "@/components/booking/BookingStatusPill";
import {
  getStoredBookingById,
  updateStoredBooking,
  type StoredBooking,
} from "@/lib/bookingsStorage";
import {
  buildTeacherAvailability,
  formatDateLong,
  type DayAvailability,
} from "@/lib/bookingUtils";
import { getTeacherById } from "@/data/mockTeachers";
import { BookingActionModal, type BookingActionMode } from "@/components/booking/BookingActionModal";
import { useToast } from "@/hooks/use-toast";

interface FollowUpSnapshot {
  updatedAt: string;
  summary: string;
  nextSteps: string;
  tags: string[];
}

const followUpByTeacher: Record<string, FollowUpSnapshot> = {
  "1": {
    updatedAt: "Ultima atualizacao: 2 dias atras",
    summary: "Trabalhamos leitura guiada e o aluno conseguiu reconhecer novas silabas com mais autonomia.",
    nextSteps: "Reforcar leitura em voz alta e manter rotina curta de 15 minutos por dia.",
    tags: ["Leitura", "Atencao", "Constancia"],
  },
  "2": {
    updatedAt: "Ultima atualizacao: 4 dias atras",
    summary: "Boa evolucao na resolucao de problemas simples e maior confianca nas operacoes basicas.",
    nextSteps: "Introduzir desafios curtos de logica antes das atividades de matematica.",
    tags: ["Matematica", "Logica", "Autonomia"],
  },
  "3": {
    updatedAt: "Ultima atualizacao: 3 dias atras",
    summary: "Sessao focada em regulacao emocional e organizacao da tarefa com pausas planejadas.",
    nextSteps: "Manter rotina visual de inicio/meio/fim durante os estudos em casa.",
    tags: ["Organizacao", "Foco", "Rotina"],
  },
};

function getFollowUpSnapshot(booking: StoredBooking): FollowUpSnapshot {
  return (
    followUpByTeacher[booking.teacherId] ?? {
      updatedAt: "Ultima atualizacao: recentemente",
      summary: "A professora registrou observacoes positivas sobre participacao e engajamento.",
      nextSteps: "Manter frequencia semanal e reforcar os exercicios sugeridos apos a aula.",
      tags: [booking.specialty, "Acompanhamento"],
    }
  );
}

export default function BookingDetail() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [booking, setBooking] = useState<StoredBooking | null>(() =>
    bookingId ? getStoredBookingById(bookingId) ?? null : null,
  );
  const [activeModalMode, setActiveModalMode] = useState<BookingActionMode>("reschedule");
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setBooking(null);
      return;
    }
    setBooking(getStoredBookingById(bookingId) ?? null);
  }, [bookingId]);

  const teacher = booking ? getTeacherById(booking.teacherId) : undefined;
  const availability = useMemo<DayAvailability[]>(() => {
    if (!booking) return [];
    return buildTeacherAvailability(booking.teacherId, { days: 14, maxSlotsPerDay: 5 });
  }, [booking]);

  if (!booking) {
    return (
      <AppShell hideNav>
        <TopBar title="Detalhe da aula" showBack />
        <div className="px-4 pt-10">
          <div className="card-kidario p-6 text-center">
            <p className="text-foreground font-medium">Nao encontramos esta aula na sua agenda.</p>
            <Link to="/agenda" className="text-primary text-sm font-medium hover:underline mt-3 inline-block">
              Voltar para agenda
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const followUp = getFollowUpSnapshot(booking);
  const canReschedule = booking.status !== "cancelada" && booking.status !== "concluida";
  const canCancel = booking.status !== "cancelada" && booking.status !== "concluida";
  const priceLabel = teacher ? `R$ ${teacher.pricePerClass}` : "A confirmar";

  const openActionModal = (mode: BookingActionMode) => {
    setActiveModalMode(mode);
    setIsActionModalOpen(true);
  };

  const handleConfirmAction = async (payload: { dateIso?: string; time?: string; reason?: string }) => {
    if (!booking) return;

    setIsSubmitting(true);

    try {
      let updatedBooking: StoredBooking | null = null;

      if (activeModalMode === "reschedule" && payload.dateIso && payload.time) {
        updatedBooking = updateStoredBooking(booking.id, {
          dateIso: payload.dateIso,
          dateLabel: formatDateLong(payload.dateIso),
          time: payload.time,
          status: "confirmada",
          updatedAtIso: new Date().toISOString(),
        });
      }

      if (activeModalMode === "cancel") {
        updatedBooking = updateStoredBooking(booking.id, {
          status: "cancelada",
          cancellationReason: payload.reason ?? "",
          updatedAtIso: new Date().toISOString(),
        });
      }

      if (!updatedBooking) {
        toast({
          title: "Nao foi possivel atualizar a aula",
          description: "Tente novamente em alguns instantes.",
        });
        return;
      }

      setBooking(updatedBooking);
      setIsActionModalOpen(false);

      toast({
        title: activeModalMode === "reschedule" ? "Aula reagendada" : "Aula cancelada",
        description:
          activeModalMode === "reschedule"
            ? "A nova data foi salva na sua agenda."
            : "A reserva foi marcada como cancelada.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell hideNav>
      <TopBar title="Detalhe da aula" showBack />

      <div className="px-4 pt-6 pb-8 space-y-5">
        <TeacherBookingHeaderCard
          teacherName={booking.teacherName}
          teacherAvatar={booking.teacherAvatar}
          specialty={booking.specialty}
          pricePerHour={teacher?.pricePerClass ?? 0}
        />

        <section className="card-kidario p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Informacoes da aula</h2>
            <BookingStatusPill status={booking.status} />
          </div>

          <div className="space-y-2 text-sm text-foreground">
            <p className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {booking.dateLabel}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              {booking.time}
            </p>
            <p className="flex items-center gap-2">
              {booking.modality === "online" ? (
                <Video className="w-4 h-4 text-primary" />
              ) : (
                <MapPin className="w-4 h-4 text-primary" />
              )}
              {booking.modality === "online" ? "Online" : "Presencial"}
            </p>
            <p className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Valor: {priceLabel}
            </p>
          </div>
        </section>

        <section className="card-kidario p-4 space-y-3">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-primary mt-1" />
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">Acompanhamento da aula</h2>
              <p className="text-xs text-muted-foreground">{followUp.updatedAt}</p>
            </div>
          </div>

          <p className="text-sm text-foreground leading-relaxed">{followUp.summary}</p>
          <p className="text-sm text-foreground leading-relaxed">
            <span className="font-medium">Proximos passos:</span> {followUp.nextSteps}
          </p>

          <div className="flex flex-wrap gap-2">
            {followUp.tags.map((tag) => (
              <span key={tag} className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {booking.cancellationReason && (
          <section className="card-kidario p-4 border-destructive/30 bg-destructive/5">
            <h3 className="font-medium text-foreground">Motivo do cancelamento</h3>
            <p className="text-sm text-muted-foreground mt-2">{booking.cancellationReason}</p>
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <KidarioButton
            type="button"
            variant="outline"
            size="lg"
            onClick={() => openActionModal("reschedule")}
            disabled={!canReschedule}
          >
            Reagendar
          </KidarioButton>
          <KidarioButton
            type="button"
            variant="destructive"
            size="lg"
            onClick={() => openActionModal("cancel")}
            disabled={!canCancel}
          >
            Cancelar aula
          </KidarioButton>
        </div>

        <KidarioButton type="button" variant="ghost" fullWidth onClick={() => navigate("/agenda")}>
          Voltar para agenda
        </KidarioButton>
      </div>

      <BookingActionModal
        open={isActionModalOpen}
        mode={activeModalMode}
        onOpenChange={setIsActionModalOpen}
        onConfirm={handleConfirmAction}
        availability={availability}
        currentDateIso={booking.dateIso}
        currentTime={booking.time}
        isSubmitting={isSubmitting}
      />
    </AppShell>
  );
}
