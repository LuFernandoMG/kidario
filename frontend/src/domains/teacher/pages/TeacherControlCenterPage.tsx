import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, MessageCircle, TrendingUp, User, Wallet, XCircle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Skeleton } from "@/components/ui/skeleton";
import { KidarioButton } from "@/components/ui/KidarioButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSupabaseAccessToken } from "@/lib/authSession";
import { getOrCreateChatThreadFromBooking } from "@/lib/backendChat";
import { type TeacherAgendaControlLesson } from "@/domains/teacher/api/backendTeacherControl";
import {
  useTeacherBookingDecisionMutation,
  useTeacherControlCenterOverview,
} from "@/domains/teacher/query/teacherControlQueries";
import {
  TEACHER_AGENDA_PATH,
  TEACHER_FINANCE_PATH,
  TEACHER_PLANNING_PATH,
  TEACHER_STUDENTS_PATH,
} from "@/domains/teacher/lib/teacherRoutes";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function getLessonTimestamp(lesson: Pick<TeacherAgendaControlLesson, "date_iso" | "time">) {
  return new Date(`${lesson.date_iso}T${lesson.time}:00`).getTime();
}

const bookingStatusLabel = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  concluida: "Concluída",
} as const;

const bookingStatusClassName = {
  pendente: "bg-warning/10 text-warning",
  confirmada: "bg-success/10 text-success",
  cancelada: "bg-destructive/10 text-destructive",
  concluida: "bg-primary/10 text-primary",
} as const;

const activityPlanSourceLabel = {
  llm: "Plano sugerido por IA",
  fallback: "Plano sugerido automaticamente",
} as const;

export default function TeacherControlCenterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [openingChatBookingId, setOpeningChatBookingId] = useState<string | null>(null);
  const [decisionBookingId, setDecisionBookingId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const decisionMutation = useTeacherBookingDecisionMutation();

  const overviewQuery = useTeacherControlCenterOverview({
    limitAgenda: 30,
    limitChats: 6,
    limitStudents: 6,
  });

  const data = overviewQuery.data;
  const pendingLessons = useMemo(() => {
    if (!data?.agenda?.length) return [];
    return data.agenda
      .filter((lesson) => lesson.status === "pendente")
      .sort((a, b) => getLessonTimestamp(a) - getLessonTimestamp(b));
  }, [data?.agenda]);

  const nearestConfirmedLesson = useMemo(() => {
    if (!data?.agenda?.length) return null;

    const now = Date.now();
    const confirmadas = data.agenda
      .filter((lesson) => lesson.status === "confirmada")
      .filter((lesson) => getLessonTimestamp(lesson) >= now)
      .sort((a, b) => getLessonTimestamp(a) - getLessonTimestamp(b));

    return confirmadas[0] ?? null;
  }, [data?.agenda]);

  const selectedLesson = useMemo(() => {
    if (!selectedLessonId || !data?.agenda?.length) return null;
    return data.agenda.find((lesson) => lesson.id === selectedLessonId) ?? null;
  }, [data?.agenda, selectedLessonId]);

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

    setOpeningChatBookingId(params.bookingId);
    try {
      const response = await getOrCreateChatThreadFromBooking(accessToken, params.bookingId);
      navigate(`/chat/${response.thread.id}`);
    } catch (error) {
      toast({
        title: "Não foi possível abrir o chat",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setOpeningChatBookingId((current) => (current === params.bookingId ? null : current));
    }
  };

  const onAccept = async (bookingId: string) => {
    setDecisionBookingId(bookingId);
    try {
      await decisionMutation.mutateAsync({
        bookingId,
        payload: { action: "accept" },
      });
      toast({ title: "Aula aceita", description: "A reserva foi confirmada." });
      if (selectedLessonId === bookingId) {
        setSelectedLessonId(null);
      }
    } catch (error) {
      toast({
        title: "Não foi possível aceitar",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setDecisionBookingId((current) => (current === bookingId ? null : current));
    }
  };

  const onReject = async (bookingId: string) => {
    const reason = window.prompt("Motivo da recusa (opcional):")?.trim() || undefined;
    setDecisionBookingId(bookingId);
    try {
      await decisionMutation.mutateAsync({
        bookingId,
        payload: { action: "reject", reason },
      });
      toast({ title: "Aula recusada", description: "A reserva foi cancelada." });
      if (selectedLessonId === bookingId) {
        setSelectedLessonId(null);
      }
    } catch (error) {
      toast({
        title: "Não foi possível recusar",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setDecisionBookingId((current) => (current === bookingId ? null : current));
    }
  };

  return (
    <AppShell>
      <TopBar title="Início" />
      <div className="px-4 pt-4 pb-8 space-y-4">
        {overviewQuery.isLoading ? (
          <TeacherControlCenterSkeleton />
        ) : overviewQuery.isError ? (
          <div className="card-kidario p-4 text-sm text-destructive">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Não foi possível carregar o centro de controle."}
          </div>
        ) : data ? (
          <>
            <section className="grid grid-cols-2 gap-3">
              <div className="card-kidario p-4">
                <p className="text-xs text-muted-foreground">Aulas próximas</p>
                <p className="text-2xl font-semibold text-foreground">{data.upcoming_lessons_count}</p>
              </div>
              <div className="card-kidario p-4">
                <p className="text-xs text-muted-foreground">Pendentes de decisão</p>
                <p className="text-2xl font-semibold text-foreground">{data.pending_decisions_count}</p>
              </div>
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Agenda e objetivos da aula
                </h2>
                <Link to={TEACHER_AGENDA_PATH} className="text-primary text-sm font-medium hover:underline">
                  Ver tudo
                </Link>
              </div>

              {pendingLessons.length === 0 && !nearestConfirmedLesson ? (
                <p className="text-sm text-muted-foreground">No tienes clases próximamente.</p>
              ) : (
                <div className="space-y-3">
                  {pendingLessons.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Pendentes para aprovação</p>
                      {pendingLessons.map((lesson) => (
                        <article key={lesson.id} className="rounded-xl border border-border/70 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{lesson.child_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {lesson.date_label} às {lesson.time}
                              </p>
                            </div>
                            <span className="rounded-full px-2 py-1 text-[11px] font-medium bg-warning/10 text-warning">
                              Pendente
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <KidarioButton
                              size="sm"
                              variant="outline"
                              disabled={!lesson.actions.can_accept || decisionMutation.isPending}
                              onClick={() => void onAccept(lesson.id)}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {decisionBookingId === lesson.id && decisionMutation.isPending ? "Aceitando..." : "Aceitar"}
                            </KidarioButton>
                            <KidarioButton
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedLessonId(lesson.id)}
                            >
                              Ver detalhes
                            </KidarioButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  {nearestConfirmedLesson && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground">Próxima aula confirmada</p>
                      <LessonDetailCard
                        lesson={nearestConfirmedLesson}
                        onOpenChat={onOpenChat}
                        openingChatBookingId={openingChatBookingId}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="grid grid-cols-2 gap-3">
              <Link to="/perfil" className="card-kidario p-4 block">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Perfil
                </p>
                <p className="text-sm text-foreground mt-1">Atualize dados e disponibilidade</p>
              </Link>
              <Link to={TEACHER_STUDENTS_PATH} className="card-kidario p-4 block">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Alunos
                </p>
                <p className="text-sm text-foreground mt-1">{data.students.length} aluno(s) acompanhados</p>
              </Link>
              <Link to={TEACHER_PLANNING_PATH} className="card-kidario p-4 block">
                <p className="text-xs text-muted-foreground">Planejamento</p>
                <p className="text-sm text-foreground mt-1">
                  {data.planning.available_slots_count} slots livres (14 dias)
                </p>
              </Link>
              <Link to={TEACHER_FINANCE_PATH} className="card-kidario p-4 block">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" />
                  Financeiro
                </p>
                <p className="text-sm text-foreground mt-1">
                  {formatCurrency(data.finance.paid_total, data.finance.currency)} recebido
                </p>
              </Link>
            </section>

            <Dialog open={Boolean(selectedLessonId)} onOpenChange={(open) => !open && setSelectedLessonId(null)}>
              <DialogContent className="max-w-2xl p-0">
                <div className="p-4 space-y-3 max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Detalle de agenda</DialogTitle>
                    <DialogDescription>Revisa la información completa y toma una acción rápida.</DialogDescription>
                  </DialogHeader>
                  {selectedLesson ? (
                    <>
                      <LessonDetailCard
                        lesson={selectedLesson}
                        onOpenChat={onOpenChat}
                        openingChatBookingId={openingChatBookingId}
                      />
                      {selectedLesson.status === "pendente" && (
                        <div className="flex flex-wrap gap-2 justify-end">
                          <KidarioButton
                            size="sm"
                            variant="outline"
                            disabled={!selectedLesson.actions.can_accept || decisionMutation.isPending}
                            onClick={() => void onAccept(selectedLesson.id)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {decisionBookingId === selectedLesson.id && decisionMutation.isPending ? "Aceitando..." : "Aceitar"}
                          </KidarioButton>
                          <KidarioButton
                            size="sm"
                            variant="outline"
                            disabled={!selectedLesson.actions.can_reject || decisionMutation.isPending}
                            onClick={() => void onReject(selectedLesson.id)}
                          >
                            <XCircle className="w-4 h-4" />
                            {decisionBookingId === selectedLesson.id && decisionMutation.isPending ? "Recusando..." : "Recusar"}
                          </KidarioButton>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No se encontró la agenda seleccionada.</p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function LessonDetailCard(props: {
  lesson: TeacherAgendaControlLesson;
  onOpenChat: (params: { bookingId: string; threadId?: string | null }) => Promise<void>;
  openingChatBookingId: string | null;
}) {
  const { lesson, onOpenChat, openingChatBookingId } = props;

  return (
    <article className="rounded-xl border border-border/70 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{lesson.child_name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {lesson.date_label} às {lesson.time} • {lesson.modality}
          </p>
          <p className="text-xs text-muted-foreground">
            {lesson.completed_lessons_with_child} aula(s) concluída(s) com este aluno
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${bookingStatusClassName[lesson.status]}`}>
          {bookingStatusLabel[lesson.status]}
        </span>
      </div>

      <div className="rounded-xl border border-border/60 p-3 space-y-2">
        <p className="text-xs font-medium text-foreground">Objetivos da aula</p>
        <ul className="space-y-1">
          {lesson.objectives.map((objective, index) => (
            <li key={`${lesson.id}-objective-${index}`} className="text-sm text-foreground">
              • {objective.objective}
              {objective.achieved ? " · Concluído" : " · Em andamento"}
              {` · Nível ${objective.fullfilment_level}/5`}
            </li>
          ))}
        </ul>
        {lesson.completed_lessons_with_child === 0 && (
          <p className="text-xs text-muted-foreground">
            Nesta primeira sessão, valide os pontos de melhoria da família e defina próximos passos.
          </p>
        )}
        {lesson.parent_focus_points.length > 0 && (
          <div className="rounded-lg bg-muted/60 p-2">
            <p className="text-xs font-medium text-foreground">Pontos de melhoria do responsável</p>
            <ul className="space-y-1 mt-1">
              {lesson.parent_focus_points.map((point, index) => (
                <li key={`${lesson.id}-focus-${index}`} className="text-xs text-muted-foreground">
                  • {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/60 p-3 space-y-2">
        <p className="text-xs font-medium text-foreground">
          {activityPlanSourceLabel[lesson.activity_plan_source]}
        </p>
        <ul className="space-y-1">
          {lesson.activity_plan.map((activity, index) => (
            <li key={`${lesson.id}-activity-${index}`} className="text-sm text-foreground">
              • {activity}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <KidarioButton
          size="sm"
          variant="outline"
          disabled={!lesson.actions.can_open_chat || openingChatBookingId === lesson.id}
          onClick={() => void onOpenChat({ bookingId: lesson.id, threadId: lesson.chat_thread_id })}
        >
          <span className="relative inline-flex">
            <MessageCircle className="w-4 h-4" />
            {lesson.has_unread_messages && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />
            )}
          </span>
          {openingChatBookingId === lesson.id ? "Abrindo..." : "Chat"}
        </KidarioButton>
      </div>
    </article>
  );
}

function TeacherControlCenterSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}
