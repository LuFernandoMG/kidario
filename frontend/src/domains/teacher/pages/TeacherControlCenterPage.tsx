import { Link } from "react-router-dom";
import { Calendar, MessageCircle, TrendingUp, User, Wallet } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherControlCenterOverview } from "@/domains/teacher/query/teacherControlQueries";
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

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}

export default function TeacherControlCenterPage() {
  const overviewQuery = useTeacherControlCenterOverview({
    limitAgenda: 6,
    limitChats: 6,
    limitStudents: 6,
  });

  const data = overviewQuery.data;

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
                  Agenda
                </h2>
                <Link to={TEACHER_AGENDA_PATH} className="text-primary text-sm font-medium hover:underline">
                  Ver tudo
                </Link>
              </div>
              {data.agenda.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma aula agendada para os próximos dias.</p>
              ) : (
                <div className="space-y-2">
                  {data.agenda.map((lesson) => (
                    <div key={lesson.id} className="rounded-xl border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{lesson.child_name}</p>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-medium ${bookingStatusClassName[lesson.status]}`}
                        >
                          {bookingStatusLabel[lesson.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lesson.date_label} às {lesson.time} • {lesson.modality}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-foreground flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  Conversas recentes
                </h2>
              </div>
              {data.chat_threads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conversa recente. O chat será liberado conforme as reservas.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.chat_threads.map((thread) => (
                    <Link
                      key={thread.thread_id}
                      to={`/chat/${thread.thread_id}`}
                      className="block rounded-xl border border-border/70 p-3 hover:border-primary/40 transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {thread.child_name} • {thread.parent_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Aula: {formatDate(thread.lesson_date_iso)} às {thread.lesson_time}
                      </p>
                    </Link>
                  ))}
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
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function TeacherControlCenterSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-44 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}
