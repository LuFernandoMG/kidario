import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { TEACHER_AGENDA_PATH } from "@/domains/teacher/lib/teacherRoutes";
import { useTeacherControlCenterOverview } from "@/domains/teacher/query/teacherControlQueries";

export default function TeacherStudentsPage() {
  const overviewQuery = useTeacherControlCenterOverview({
    limitAgenda: 6,
    limitChats: 6,
    limitStudents: 30,
  });

  const students = overviewQuery.data?.students ?? [];
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

            {students.map((student) => {
              const completionRate =
                student.total_lessons > 0
                  ? Math.min(100, Math.round((student.completed_lessons / student.total_lessons) * 100))
                  : 0;

              return (
                <div key={student.child_id} className="card-kidario p-4 space-y-2">
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
                  {student.latest_follow_up_summary && (
                    <p className="text-sm text-foreground">{student.latest_follow_up_summary}</p>
                  )}
                </div>
              );
            })}

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
