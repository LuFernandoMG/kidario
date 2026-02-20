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
import { buildTeacherAvailability, formatDateLong, type DayAvailability } from "@/lib/bookingUtils";
import { getTeacherById } from "@/data/mockTeachers";
import { BookingActionModal, type BookingActionMode } from "@/components/booking/BookingActionModal";
import { useToast } from "@/hooks/use-toast";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import {
  cancelBooking,
  getBookingDetail,
  getTeacherAvailabilitySlots,
  rescheduleBooking,
  type BookingDetailResponse,
} from "@/lib/backendBookings";

interface FollowUpSnapshot {
  updatedAt: string;
  summary: string;
  nextSteps: string;
  tags: string[];
  attentionPoints: string[];
}

const followUpByTeacher: Record<string, FollowUpSnapshot> = {
  "1": {
    updatedAt: "Ultima atualizacao: 2 dias atras",
    summary: "Trabalhamos leitura guiada e o aluno conseguiu reconhecer novas silabas com mais autonomia.",
    nextSteps: "Reforcar leitura em voz alta e manter rotina curta de 15 minutos por dia.",
    tags: ["Leitura", "Atencao", "Constancia"],
    attentionPoints: [],
  },
  "2": {
    updatedAt: "Ultima atualizacao: 4 dias atras",
    summary: "Boa evolucao na resolucao de problemas simples e maior confianca nas operacoes basicas.",
    nextSteps: "Introduzir desafios curtos de logica antes das atividades de matematica.",
    tags: ["Matematica", "Logica", "Autonomia"],
    attentionPoints: [],
  },
  "3": {
    updatedAt: "Ultima atualizacao: 3 dias atras",
    summary: "Sessao focada em regulacao emocional e organizacao da tarefa com pausas planejadas.",
    nextSteps: "Manter rotina visual de inicio/meio/fim durante os estudos em casa.",
    tags: ["Organizacao", "Foco", "Rotina"],
    attentionPoints: [],
  },
};

function mapBackendDetailToStoredBooking(detail: BookingDetailResponse, fallback?: StoredBooking | null): StoredBooking {
  return {
    id: detail.id,
    teacherId: detail.teacher_id,
    teacherName: detail.teacher_name,
    teacherAvatar:
      detail.teacher_avatar_url ||
      fallback?.teacherAvatar ||
      "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
    specialty: detail.specialty || fallback?.specialty || "Apoio pedagogico",
    dateLabel: detail.date_label,
    dateIso: detail.date_iso,
    time: detail.time,
    modality: detail.modality,
    status: detail.status,
    createdAtIso: fallback?.createdAtIso || new Date().toISOString(),
    updatedAtIso: new Date().toISOString(),
    cancellationReason: detail.cancellation_reason || undefined,
  };
}

function getLocalFollowUpSnapshot(booking: StoredBooking): FollowUpSnapshot {
  return (
    followUpByTeacher[booking.teacherId] ?? {
      updatedAt: "Ultima atualizacao: recentemente",
      summary: "A professora registrou observacoes positivas sobre participacao e engajamento.",
      nextSteps: "Manter frequencia semanal e reforcar os exercicios sugeridos apos a aula.",
      tags: [booking.specialty, "Acompanhamento"],
      attentionPoints: [],
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
  const [backendDetail, setBackendDetail] = useState<BookingDetailResponse | null>(null);
  const [isBackendSource, setIsBackendSource] = useState(false);
  const [activeModalMode, setActiveModalMode] = useState<BookingActionMode>("reschedule");
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteAvailability, setRemoteAvailability] = useState<DayAvailability[] | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setBooking(null);
      setBackendDetail(null);
      setIsBackendSource(false);
      return;
    }

    const localBooking = getStoredBookingById(bookingId) ?? null;
    setBooking(localBooking);

    const authSession = getAuthSession();
    const accessToken = getSupabaseAccessToken();
    if (!authSession.isAuthenticated || !accessToken) {
      setBackendDetail(null);
      setIsBackendSource(false);
      return;
    }

    let isMounted = true;
    getBookingDetail(accessToken, bookingId)
      .then((detail) => {
        if (!isMounted) return;
        setBackendDetail(detail);
        setIsBackendSource(true);
        setBooking(mapBackendDetailToStoredBooking(detail, localBooking));
      })
      .catch(() => {
        if (!isMounted) return;
        setBackendDetail(null);
        setIsBackendSource(false);
      });

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  const localAvailability = useMemo<DayAvailability[]>(() => {
    if (!booking) return [];
    return buildTeacherAvailability(booking.teacherId, { days: 14, maxSlotsPerDay: 5 });
  }, [booking]);

  const availability = remoteAvailability && remoteAvailability.length > 0 ? remoteAvailability : localAvailability;
  const teacher = booking ? getTeacherById(booking.teacherId) : undefined;

  useEffect(() => {
    if (!isActionModalOpen || activeModalMode !== "reschedule") return;
    if (!backendDetail) {
      setRemoteAvailability(null);
      return;
    }

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setRemoteAvailability(null);
      return;
    }

    const from = new Date();
    const to = new Date();
    to.setDate(from.getDate() + 14);
    const fromIso = from.toISOString().slice(0, 10);
    const toIso = to.toISOString().slice(0, 10);

    getTeacherAvailabilitySlots(accessToken, {
      teacherProfileId: backendDetail.teacher_id,
      from: fromIso,
      to: toIso,
      durationMinutes: backendDetail.duration_minutes,
    })
      .then((response) => {
        const mappedSlots: DayAvailability[] = response.slots.map((slot) => ({
          dateIso: slot.date_iso,
          dateLabel: slot.date_label,
          slots: slot.times,
        }));
        setRemoteAvailability(mappedSlots);
      })
      .catch(() => setRemoteAvailability(null));
  }, [activeModalMode, backendDetail, isActionModalOpen]);

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

  const followUp: FollowUpSnapshot =
    backendDetail?.latest_follow_up
      ? {
          updatedAt: `Ultima atualizacao: ${new Date(
            backendDetail.latest_follow_up.updated_at,
          ).toLocaleDateString("pt-BR")}`,
          summary: backendDetail.latest_follow_up.summary,
          nextSteps: backendDetail.latest_follow_up.next_steps,
          tags: backendDetail.latest_follow_up.tags,
          attentionPoints: backendDetail.latest_follow_up.attention_points || [],
        }
      : getLocalFollowUpSnapshot(booking);

  const canReschedule = backendDetail
    ? backendDetail.actions.can_reschedule
    : booking.status !== "cancelada" && booking.status !== "concluida";
  const canCancel = backendDetail
    ? backendDetail.actions.can_cancel
    : booking.status !== "cancelada" && booking.status !== "concluida";

  const priceValue = backendDetail ? backendDetail.price_total : teacher?.pricePerClass ?? 0;
  const priceLabel = `R$ ${Math.round(priceValue)}`;
  const pricePerHour = backendDetail
    ? Math.round(backendDetail.price_total / Math.max(backendDetail.duration_minutes / 60, 1))
    : teacher?.pricePerClass ?? 0;

  const openActionModal = (mode: BookingActionMode) => {
    setActiveModalMode(mode);
    setIsActionModalOpen(true);
  };

  const handleConfirmAction = async (payload: { dateIso?: string; time?: string; reason?: string }) => {
    if (!booking) return;

    setIsSubmitting(true);
    const accessToken = getSupabaseAccessToken();

    if (isBackendSource && accessToken) {
      try {
        if (activeModalMode === "reschedule" && payload.dateIso && payload.time) {
          await rescheduleBooking(accessToken, booking.id, {
            new_date_iso: payload.dateIso,
            new_time: payload.time,
          });
        }

        if (activeModalMode === "cancel") {
          await cancelBooking(accessToken, booking.id, {
            reason: payload.reason || "Cancelado pelo responsavel.",
          });
        }

        const refreshed = await getBookingDetail(accessToken, booking.id);
        const mappedBooking = mapBackendDetailToStoredBooking(refreshed, booking);

        setBackendDetail(refreshed);
        setBooking(mappedBooking);
        setIsActionModalOpen(false);

        updateStoredBooking(booking.id, {
          dateIso: mappedBooking.dateIso,
          dateLabel: mappedBooking.dateLabel,
          time: mappedBooking.time,
          status: mappedBooking.status,
          cancellationReason: mappedBooking.cancellationReason,
          updatedAtIso: new Date().toISOString(),
        });

        toast({
          title: activeModalMode === "reschedule" ? "Aula reagendada" : "Aula cancelada",
          description:
            activeModalMode === "reschedule"
              ? "A nova data foi salva na sua agenda."
              : "A reserva foi marcada como cancelada.",
        });
      } catch (error) {
        toast({
          title: "Nao foi possivel atualizar a aula",
          description:
            error instanceof Error ? error.message : "Tente novamente em alguns instantes.",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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

  const cancellationReason = backendDetail?.cancellation_reason || booking.cancellationReason;

  return (
    <AppShell hideNav>
      <TopBar title="Detalhe da aula" showBack />

      <div className="px-4 pt-6 pb-8 space-y-5">
        <TeacherBookingHeaderCard
          teacherName={booking.teacherName}
          teacherAvatar={booking.teacherAvatar}
          specialty={booking.specialty}
          pricePerHour={pricePerHour}
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

          {followUp.attentionPoints.length > 0 && (
            <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
              <p className="text-sm font-medium text-foreground">Pontos de atencao</p>
              <ul className="space-y-1">
                {followUp.attentionPoints.map((point, index) => (
                  <li key={`${point}-${index}`} className="text-sm text-muted-foreground">
                    • {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {cancellationReason && (
          <section className="card-kidario p-4 border-destructive/30 bg-destructive/5">
            <h3 className="font-medium text-foreground">Motivo do cancelamento</h3>
            <p className="text-sm text-muted-foreground mt-2">{cancellationReason}</p>
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
