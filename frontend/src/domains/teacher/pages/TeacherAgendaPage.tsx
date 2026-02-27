import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateChatThreadFromBooking } from "@/lib/backendChat";
import { getSupabaseAccessToken } from "@/lib/authSession";
import { TEACHER_PLANNING_PATH } from "@/domains/teacher/lib/teacherRoutes";
import { TeacherAgendaLessonCard } from "@/domains/teacher/components/TeacherAgendaLessonCard";
import {
  useTeacherBookingDecisionMutation,
  useTeacherBookingRescheduleMutation,
  useTeacherControlCenterOverview,
} from "@/domains/teacher/query/teacherControlQueries";

interface RescheduleState {
  dateIso: string;
  time: string;
}

type AgendaFilter = "todas" | "pendentes" | "confirmadas" | "concluidas" | "canceladas";

const agendaFilters: { value: AgendaFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendentes", label: "Pendentes" },
  { value: "confirmadas", label: "Confirmadas" },
  { value: "concluidas", label: "Concluídas" },
  { value: "canceladas", label: "Canceladas" },
];

export default function TeacherAgendaPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<AgendaFilter>("todas");
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [rescheduleState, setRescheduleState] = useState<Record<string, RescheduleState>>({});

  const overviewQuery = useTeacherControlCenterOverview({
    limitAgenda: 24,
    limitChats: 6,
    limitStudents: 6,
  });
  const decisionMutation = useTeacherBookingDecisionMutation();
  const rescheduleMutation = useTeacherBookingRescheduleMutation();

  const lessons = useMemo(() => overviewQuery.data?.agenda ?? [], [overviewQuery.data?.agenda]);
  const sortedLessons = useMemo(() => {
    return [...lessons].sort((a, b) => {
      const aIsConcluded = a.status === "concluida" ? 1 : 0;
      const bIsConcluded = b.status === "concluida" ? 1 : 0;
      if (aIsConcluded !== bIsConcluded) return aIsConcluded - bIsConcluded;

      const aTime = new Date(`${a.date_iso}T${a.time}:00`).getTime();
      const bTime = new Date(`${b.date_iso}T${b.time}:00`).getTime();
      return aTime - bTime;
    });
  }, [lessons]);

  const filteredLessons = useMemo(() => {
    if (activeFilter === "pendentes") {
      return sortedLessons.filter((lesson) => lesson.status === "pendente");
    }
    if (activeFilter === "confirmadas") {
      return sortedLessons.filter((lesson) => lesson.status === "confirmada");
    }
    if (activeFilter === "concluidas") {
      return sortedLessons.filter((lesson) => lesson.status === "concluida");
    }
    if (activeFilter === "canceladas") {
      return sortedLessons.filter((lesson) => lesson.status === "cancelada");
    }
    return sortedLessons;
  }, [activeFilter, sortedLessons]);

  const upcomingCount = useMemo(
    () => lessons.filter((lesson) => lesson.status === "pendente" || lesson.status === "confirmada").length,
    [lessons],
  );

  const pendingCount = useMemo(
    () => lessons.filter((lesson) => lesson.status === "pendente").length,
    [lessons],
  );

  const confirmedCount = useMemo(
    () => lessons.filter((lesson) => lesson.status === "confirmada").length,
    [lessons],
  );

  const isMutating = decisionMutation.isPending || rescheduleMutation.isPending;
  const todayIso = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const onAccept = async (bookingId: string) => {
    if (isMutating) return;
    try {
      await decisionMutation.mutateAsync({
        bookingId,
        payload: { action: "accept" },
      });
      toast({ title: "Aula aceita", description: "A reserva foi confirmada." });
    } catch (error) {
      toast({
        title: "Não foi possível aceitar",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const onReject = async (bookingId: string) => {
    if (isMutating) return;
    const reason = window.prompt("Motivo da recusa (opcional):")?.trim() || undefined;
    try {
      await decisionMutation.mutateAsync({
        bookingId,
        payload: { action: "reject", reason },
      });
      toast({ title: "Aula recusada", description: "A reserva foi cancelada." });
    } catch (error) {
      toast({
        title: "Não foi possível recusar",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const onSaveReschedule = async (bookingId: string) => {
    if (isMutating) return;
    const payload = rescheduleState[bookingId];
    if (!payload?.dateIso || !payload.time) {
      toast({ title: "Dados incompletos", description: "Informe data e horário para reagendar." });
      return;
    }
    try {
      await rescheduleMutation.mutateAsync({
        bookingId,
        payload: {
          new_date_iso: payload.dateIso,
          new_time: payload.time,
        },
      });
      toast({ title: "Aula reagendada", description: "Nova data salva com sucesso." });
      setEditingBookingId(null);
    } catch (error) {
      toast({
        title: "Não foi possível reagendar",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const onOpenChat = async (params: { bookingId: string; threadId?: string | null }) => {
    if (params.threadId) {
      navigate(`/chat/${params.threadId}`);
      return;
    }

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      toast({
        title: "Sessão inválida",
        description: "Faça login novamente para abrir o chat.",
      });
      return;
    }

    try {
      const response = await getOrCreateChatThreadFromBooking(accessToken, params.bookingId);
      navigate(`/chat/${response.thread.id}`);
    } catch (error) {
      toast({
        title: "Não foi possível abrir o chat",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const onToggleReschedule = (lessonId: string, defaults: { dateIso: string; time: string }) => {
    if (isMutating) return;
    setEditingBookingId((current) => (current === lessonId ? null : lessonId));
    setRescheduleState((current) => ({
      ...current,
      [lessonId]: {
        dateIso: current[lessonId]?.dateIso || defaults.dateIso,
        time: current[lessonId]?.time || defaults.time,
      },
    }));
  };

  const onRescheduleDateChange = (bookingId: string, dateIso: string, fallbackTime: string) => {
    setRescheduleState((current) => ({
      ...current,
      [bookingId]: {
        ...current[bookingId],
        dateIso,
        time: current[bookingId]?.time || fallbackTime,
      },
    }));
  };

  const onRescheduleTimeChange = (bookingId: string, time: string, fallbackDateIso: string) => {
    setRescheduleState((current) => ({
      ...current,
      [bookingId]: {
        ...current[bookingId],
        time,
        dateIso: current[bookingId]?.dateIso || fallbackDateIso,
      },
    }));
  };

  return (
    <AppShell>
      <TopBar title="Agenda da professora" />
      <div className="px-4 pt-4 pb-8 space-y-3">
        {overviewQuery.isLoading ? (
          <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando agenda...</div>
        ) : overviewQuery.isError ? (
          <div className="card-kidario p-4 text-sm text-destructive">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Não foi possível carregar a agenda."}
          </div>
        ) : (
          <>
            <section className="grid grid-cols-3 gap-3">
              <SummaryCard title="Próximas" value={upcomingCount} />
              <SummaryCard title="Pendentes" value={pendingCount} />
              <SummaryCard title="Confirmadas" value={confirmedCount} />
            </section>

            <section className="card-kidario overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-3">
              <div className="flex flex-row gap-2">
                {agendaFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`h-9 rounded-full px-3 text-sm font-medium border transition-colors ${
                      activeFilter === filter.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/40"
                    }`}
                    onClick={() => setActiveFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="card-kidario p-4">
              <p className="text-sm text-foreground">
                Precisa abrir novos horários para a semana?
                <Link to={TEACHER_PLANNING_PATH} className="text-primary font-medium hover:underline ml-1">
                  Ir para planejamento
                </Link>
              </p>
            </section>

            {filteredLessons.length === 0 ? (
              <div className="card-kidario p-4 text-sm text-muted-foreground">
                {activeFilter === "pendentes"
                  ? "Sem reservas pendentes de decisão."
                  : activeFilter === "confirmadas"
                    ? "Sem reservas confirmadas no momento."
                    : "No tienes clases próximamente."}
              </div>
            ) : (
              filteredLessons.map((lesson) => {
                const isEditing = editingBookingId === lesson.id;
                const currentDate = rescheduleState[lesson.id]?.dateIso ?? lesson.date_iso;
                const currentTime = rescheduleState[lesson.id]?.time ?? lesson.time;

                return (
                  <TeacherAgendaLessonCard
                    key={lesson.id}
                    lesson={lesson}
                    isEditing={isEditing}
                    currentDate={currentDate}
                    currentTime={currentTime}
                    minDateIso={todayIso}
                    onOpenChat={(params) => void onOpenChat(params)}
                    onAccept={(bookingId) => void onAccept(bookingId)}
                    onReject={(bookingId) => void onReject(bookingId)}
                    onToggleReschedule={(bookingId) =>
                      onToggleReschedule(bookingId, { dateIso: lesson.date_iso, time: lesson.time })
                    }
                    onRescheduleDateChange={(bookingId, dateIso) =>
                      onRescheduleDateChange(bookingId, dateIso, lesson.time)
                    }
                    onRescheduleTimeChange={(bookingId, time) =>
                      onRescheduleTimeChange(bookingId, time, lesson.date_iso)
                    }
                    onSaveReschedule={(bookingId) => void onSaveReschedule(bookingId)}
                    onCancelReschedule={() => setEditingBookingId(null)}
                  />
                );
              })
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="card-kidario p-3">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
