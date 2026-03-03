import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TEACHER_AGENDA_PATH } from "@/domains/teacher/lib/teacherRoutes";
import {
  useTeacherControlCenterOverview,
  useTeacherStudentTimeline,
} from "@/domains/teacher/query/teacherControlQueries";

export default function TeacherStudentsPage() {
  const overviewQuery = useTeacherControlCenterOverview({
    limitAgenda: 6,
    limitChats: 6,
    limitStudents: 30,
  });
  const [selectedChildId, setSelectedChildId] = useState<string>("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const students = useMemo(() => overviewQuery.data?.students ?? [], [overviewQuery.data?.students]);

  useEffect(() => {
    if (!students.length) {
      setSelectedChildId("");
      return;
    }
    const selectedStillExists = students.some((student) => student.child_id === selectedChildId);
    if (!selectedChildId || !selectedStillExists) {
      setSelectedChildId(students[0].child_id);
    }
  }, [selectedChildId, students]);

  useEffect(() => {
    setSelectedBookingId(null);
  }, [selectedChildId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.child_id === selectedChildId) ?? null,
    [selectedChildId, students],
  );
  const studentTimelineQuery = useTeacherStudentTimeline({
    childId: selectedStudent?.child_id,
    limit: 120,
  });
  const timeline = useMemo(
    () => studentTimelineQuery.data?.timeline ?? [],
    [studentTimelineQuery.data?.timeline],
  );

  const selectedTimelineEntry = useMemo(
    () => timeline.find((entry) => entry.booking_id === selectedBookingId) ?? null,
    [timeline, selectedBookingId],
  );

  const totalCompletedLessons = students.reduce(
    (accumulator, student) => accumulator + student.completed_lessons,
    0,
  );
  const studentsWithConsistentProgress = students.filter(
    (student) => student.progress_status === "consistente",
  ).length;

  return (
    <AppShell>
      <TopBar title="Alunos e Evolução" />
      <div className="px-4 pt-4 pb-8 space-y-3">
        {overviewQuery.isLoading ? (
          <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando alunos...</div>
        ) : overviewQuery.isError ? (
          <div className="card-kidario p-4 text-sm text-destructive">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Não foi possível carregar os alunos."}
          </div>
        ) : students.length ? (
          <>
            <section className="grid grid-cols-3 gap-2">
              <SummaryCard title="Alunos" value={students.length} />
              <SummaryCard title="Concluídas" value={totalCompletedLessons} />
              <SummaryCard title="Consistentes" value={studentsWithConsistentProgress} />
            </section>

            <section className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Escolha o aluno</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {students.map((student) => {
                  const completionRate =
                    student.total_lessons > 0
                      ? Math.min(100, Math.round((student.completed_lessons / student.total_lessons) * 100))
                      : 0;
                  const isSelected = selectedStudent?.child_id === student.child_id;

                  return (
                    <button
                      key={student.child_id}
                      type="button"
                      className={`card-kidario p-4 space-y-2 text-left transition-colors ${
                        isSelected ? "ring-1 ring-primary border-primary/40" : ""
                      }`}
                      onClick={() => setSelectedChildId(student.child_id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          {student.child_name}
                          {student.child_age != null ? ` (${student.child_age} anos)` : ""}
                        </p>
                        <ProgressBadge status={student.progress_status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {student.completed_lessons} aula(s) concluída(s) de {student.total_lessons} total.
                      </p>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Última aula: {student.latest_lesson_date ? formatDate(student.latest_lesson_date) : "-"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card-kidario p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Timeline de classes
                    {selectedStudent ? ` · ${selectedStudent.child_name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Resumo final, horário da aula e objetivos recentes.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {studentTimelineQuery.data?.total_completed_lessons ?? 0} concluída(s)
                </span>
              </div>

              {studentTimelineQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando timeline...</p>
              ) : studentTimelineQuery.isError ? (
                <p className="text-sm text-destructive">
                  {studentTimelineQuery.error instanceof Error
                    ? studentTimelineQuery.error.message
                    : "Não foi possível carregar o timeline do aluno."}
                </p>
              ) : timeline.length ? (
                <div className="space-y-2">
                  {timeline.map((entry) => (
                    <article key={entry.booking_id} className="rounded-xl border border-border/70 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {entry.date_label} às {entry.time}
                        </p>
                        <KidarioButton size="sm" variant="outline" onClick={() => setSelectedBookingId(entry.booking_id)}>
                          Detalhes
                        </KidarioButton>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-foreground">Resumo da conclusão</p>
                        <p className="text-sm text-foreground">
                          {entry.summary?.trim() || "Sem resumo registrado para esta aula."}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-foreground">Objetivos recentes</p>
                        {entry.recent_objectives.length ? (
                          <ul className="space-y-1">
                            {entry.recent_objectives.map((objective, index) => (
                              <li key={`${entry.booking_id}-objective-${index}`} className="text-sm text-muted-foreground">
                                • {objective.objective}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">Sem objetivos registrados nesta aula.</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ainda não há aulas concluídas para este aluno.
                </p>
              )}
            </section>

            <Dialog open={Boolean(selectedBookingId)} onOpenChange={(open) => !open && setSelectedBookingId(null)}>
              <DialogContent className="max-w-2xl p-0">
                <div className="p-4 space-y-3 max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Informe completo da aula</DialogTitle>
                    <DialogDescription>Visualização em modo leitura do follow-up registrado.</DialogDescription>
                  </DialogHeader>

                  <BookingFollowUpReadOnly
                    timelineEntry={selectedTimelineEntry}
                    fallbackDateLabel={selectedTimelineEntry?.date_label}
                    fallbackTime={selectedTimelineEntry?.time}
                  />
                </div>
              </DialogContent>
            </Dialog>

            <section className="card-kidario p-4">
              <p className="text-sm text-foreground">
                Para acompanhar os próximos encontros e tomar decisões:
                <Link to={TEACHER_AGENDA_PATH} className="ml-1 text-primary font-medium hover:underline">
                  abrir agenda
                </Link>
              </p>
            </section>
          </>
        ) : (
          <div className="card-kidario p-4 text-sm text-muted-foreground space-y-2">
            <p>Nenhum aluno associado a aulas ainda.</p>
            <p>
              Quando as primeiras reservas forem criadas, a evolução dos alunos aparecerá aqui.
              <Link to={TEACHER_AGENDA_PATH} className="ml-1 text-primary font-medium hover:underline">
                Ir para agenda
              </Link>
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function BookingFollowUpReadOnly(props: {
  timelineEntry: {
    child_name: string;
    date_label: string;
    time: string;
    follow_up?: {
      summary: string;
      next_steps: string;
      objectives: Array<{
        objective: string;
        achieved: boolean;
        fullfilment_level: 0 | 1 | 2 | 3 | 4 | 5;
      }>;
      next_objectives: Array<{
        objective: string;
        achieved: boolean;
        fullfilment_level: 0 | 1 | 2 | 3 | 4 | 5;
      }>;
      tags: string[];
      attention_points: string[];
    } | null;
  } | null;
  fallbackDateLabel?: string;
  fallbackTime?: string;
}) {
  const { timelineEntry, fallbackDateLabel, fallbackTime } = props;
  const followUp = timelineEntry?.follow_up ?? null;

  if (!timelineEntry) {
    return <p className="text-sm text-muted-foreground">No se encontró la clase seleccionada.</p>;
  }

  return (
    <>
      <section className="rounded-xl border border-border/70 p-3 space-y-1">
        <p className="text-sm font-medium text-foreground">{timelineEntry.child_name}</p>
        <p className="text-xs text-muted-foreground">
          {timelineEntry.date_label || fallbackDateLabel || "-"} às {timelineEntry.time || fallbackTime || "-"}
        </p>
      </section>

      {!followUp ? (
        <section className="rounded-xl border border-border/70 p-3">
          <p className="text-sm text-muted-foreground">Esta aula não possui follow-up registrado.</p>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-border/70 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Resumo de evolução</p>
            <p className="text-sm text-foreground">{followUp.summary}</p>
          </section>

          <section className="rounded-xl border border-border/70 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Próximos passos</p>
            <p className="text-sm text-foreground">{followUp.next_steps}</p>
          </section>

          <section className="rounded-xl border border-border/70 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Objetivos avaliados na aula</p>
            {followUp.objectives.length ? (
              <ul className="space-y-1">
                {followUp.objectives.map((objective, index) => (
                  <li key={`objective-${index}`} className="text-sm text-foreground">
                    • {objective.objective}
                    {objective.achieved ? " · Concluído" : " · Em andamento"}
                    {` · Nível ${objective.fullfilment_level}/5`}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem objetivos registrados.</p>
            )}
          </section>

          <section className="rounded-xl border border-border/70 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Objetivos para a próxima aula</p>
            {followUp.next_objectives.length ? (
              <ul className="space-y-1">
                {followUp.next_objectives.map((objective, index) => (
                  <li key={`next-objective-${index}`} className="text-sm text-foreground">
                    • {objective.objective}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem objetivos registrados.</p>
            )}
          </section>

          <section className="rounded-xl border border-border/70 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Tags da sessão</p>
            {followUp.tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {followUp.tags.map((tag, index) => (
                  <span
                    key={`tag-${index}`}
                    className="inline-flex rounded-full bg-muted px-2 py-1 text-xs text-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem tags registradas.</p>
            )}
          </section>

          <section className="rounded-xl border border-border/70 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Pontos de atenção para responsáveis</p>
            {followUp.attention_points.length ? (
              <ul className="space-y-1">
                {followUp.attention_points.map((point, index) => (
                  <li key={`attention-point-${index}`} className="text-sm text-foreground">
                    • {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Sem pontos de atenção registrados.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="card-kidario p-3">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ProgressBadge({ status }: { status: "sem_dados" | "atencao" | "consistente" }) {
  const labelByStatus = {
    sem_dados: "Sem dados",
    atencao: "Atenção",
    consistente: "Consistente",
  } as const;

  const classNameByStatus = {
    sem_dados: "bg-muted text-muted-foreground",
    atencao: "bg-warning/10 text-warning",
    consistente: "bg-success/10 text-success",
  } as const;

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${classNameByStatus[status]}`}>
      {labelByStatus[status]}
    </span>
  );
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}
