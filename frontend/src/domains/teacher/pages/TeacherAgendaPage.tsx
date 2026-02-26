import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, MessageCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateChatThreadFromBooking } from "@/lib/backendChat";
import { getSupabaseAccessToken } from "@/lib/authSession";
import { TEACHER_PLANNING_PATH } from "@/domains/teacher/lib/teacherRoutes";
import {
  useTeacherBookingDecisionMutation,
  useTeacherBookingRescheduleMutation,
  useTeacherControlCenterOverview,
} from "@/domains/teacher/query/teacherControlQueries";

interface RescheduleState {
  dateIso: string;
  time: string;
}

type AgendaFilter = "todas" | "pendentes" | "confirmadas";

const agendaFilters: { value: AgendaFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendentes", label: "Pendentes" },
  { value: "confirmadas", label: "Confirmadas" },
];

const statusLabelByBooking = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  concluida: "Concluída",
} as const;

const statusClassNameByBooking = {
  pendente: "bg-warning/10 text-warning",
  confirmada: "bg-success/10 text-success",
  cancelada: "bg-destructive/10 text-destructive",
  concluida: "bg-primary/10 text-primary",
} as const;

const modalityLabelByLesson = {
  online: "Online",
  presencial: "Presencial",
} as const;

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

  const filteredLessons = useMemo(() => {
    if (activeFilter === "pendentes") {
      return lessons.filter((lesson) => lesson.status === "pendente");
    }
    if (activeFilter === "confirmadas") {
      return lessons.filter((lesson) => lesson.status === "confirmada");
    }
    return lessons;
  }, [activeFilter, lessons]);

  const pendingCount = useMemo(
    () => lessons.filter((lesson) => lesson.status === "pendente").length,
    [lessons],
  );

  const confirmedCount = useMemo(
    () => lessons.filter((lesson) => lesson.status === "confirmada").length,
    [lessons],
  );

  const onAccept = async (bookingId: string) => {
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

  const isMutating = decisionMutation.isPending || rescheduleMutation.isPending;

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
              <SummaryCard title="Próximas" value={lessons.length} />
              <SummaryCard title="Pendentes" value={pendingCount} />
              <SummaryCard title="Confirmadas" value={confirmedCount} />
            </section>

            <section className="card-kidario p-3">
              <div className="flex flex-wrap gap-2">
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
                    : "Não há aulas próximas para gestão."}
              </div>
            ) : (
              filteredLessons.map((lesson) => {
                const isEditing = editingBookingId === lesson.id;
                const currentDate = rescheduleState[lesson.id]?.dateIso ?? lesson.date_iso;
                const currentTime = rescheduleState[lesson.id]?.time ?? lesson.time;

                return (
                  <div key={lesson.id} className="card-kidario p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{lesson.child_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Calendar className="inline w-3.5 h-3.5 mr-1" />
                          {lesson.date_label} às {lesson.time}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {modalityLabelByLesson[lesson.modality]} • {lesson.duration_minutes} minutos
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-medium ${statusClassNameByBooking[lesson.status]}`}
                      >
                        {statusLabelByBooking[lesson.status]}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <KidarioButton
                        size="sm"
                        variant="outline"
                        disabled={isMutating || !lesson.actions.can_accept}
                        onClick={() => void onAccept(lesson.id)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aceitar
                      </KidarioButton>
                      <KidarioButton
                        size="sm"
                        variant="outline"
                        disabled={isMutating || !lesson.actions.can_reject}
                        onClick={() => void onReject(lesson.id)}
                      >
                        <XCircle className="w-4 h-4" />
                        Recusar
                      </KidarioButton>
                      <KidarioButton
                        size="sm"
                        variant="outline"
                        disabled={!lesson.actions.can_reschedule}
                        onClick={() => {
                          setEditingBookingId((current) => (current === lesson.id ? null : lesson.id));
                          setRescheduleState((current) => ({
                            ...current,
                            [lesson.id]: {
                              dateIso: current[lesson.id]?.dateIso || lesson.date_iso,
                              time: current[lesson.id]?.time || lesson.time,
                            },
                          }));
                        }}
                      >
                        Reagendar
                      </KidarioButton>
                      <KidarioButton
                        size="sm"
                        variant="outline"
                        disabled={!lesson.actions.can_open_chat}
                        onClick={() => void onOpenChat({ bookingId: lesson.id, threadId: lesson.chat_thread_id })}
                      >
                        <MessageCircle className="w-4 h-4" />
                        Chat
                      </KidarioButton>
                    </div>

                    {isEditing && (
                      <div className="rounded-xl border border-border/70 p-3 space-y-3">
                        <p className="text-xs text-muted-foreground">Novo horário da aula</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                            value={currentDate}
                            min={format(new Date(), "yyyy-MM-dd")}
                            onChange={(event) =>
                              setRescheduleState((current) => ({
                                ...current,
                                [lesson.id]: {
                                  ...current[lesson.id],
                                  dateIso: event.target.value,
                                  time: current[lesson.id]?.time || lesson.time,
                                },
                              }))
                            }
                          />
                          <input
                            type="time"
                            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                            value={currentTime}
                            onChange={(event) =>
                              setRescheduleState((current) => ({
                                ...current,
                                [lesson.id]: {
                                  ...current[lesson.id],
                                  time: event.target.value,
                                  dateIso: current[lesson.id]?.dateIso || lesson.date_iso,
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <KidarioButton
                            size="sm"
                            variant="hero"
                            disabled={isMutating}
                            onClick={() => void onSaveReschedule(lesson.id)}
                          >
                            Confirmar reagendamento
                          </KidarioButton>
                          <KidarioButton size="sm" variant="ghost" onClick={() => setEditingBookingId(null)}>
                            Cancelar
                          </KidarioButton>
                        </div>
                      </div>
                    )}
                  </div>
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
