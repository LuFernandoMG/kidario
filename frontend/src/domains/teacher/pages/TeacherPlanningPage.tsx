import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { TEACHER_AGENDA_PATH } from "@/domains/teacher/lib/teacherRoutes";
import { useTeacherControlCenterOverview } from "@/domains/teacher/query/teacherControlQueries";

export default function TeacherPlanningPage() {
  const overviewQuery = useTeacherControlCenterOverview({
    limitAgenda: 6,
    limitChats: 6,
    limitStudents: 6,
  });

  const planning = overviewQuery.data?.planning;
  const occupancyRate = planning?.occupancy_rate_percent ?? 0;
  const occupancyTone =
    occupancyRate >= 80
      ? "text-success"
      : occupancyRate >= 50
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <AppShell>
      <TopBar title="Planejamento de Aulas" />
      <div className="px-4 pt-4 pb-8 space-y-3">
        {overviewQuery.isLoading ? (
          <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando planejamento...</div>
        ) : overviewQuery.isError ? (
          <div className="card-kidario p-4 text-sm text-destructive">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Não foi possível carregar o planejamento."}
          </div>
        ) : planning ? (
          <>
            <div className="card-kidario p-4">
              <p className="text-xs text-muted-foreground">Janela de planejamento</p>
              <p className="text-sm text-foreground">
                {formatDate(planning.window_start)} até {formatDate(planning.window_end)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="card-kidario p-4">
                <p className="text-xs text-muted-foreground">Slots disponíveis</p>
                <p className="text-2xl font-semibold text-foreground">{planning.available_slots_count}</p>
              </div>
              <div className="card-kidario p-4">
                <p className="text-xs text-muted-foreground">Aulas previstas</p>
                <p className="text-2xl font-semibold text-foreground">{planning.upcoming_lessons_count}</p>
              </div>
            </div>
            <div className="card-kidario p-4">
              <p className="text-xs text-muted-foreground">Taxa de ocupação</p>
              <p className={`text-2xl font-semibold ${occupancyTone}`}>{planning.occupancy_rate_percent}%</p>
            </div>

            <div className="card-kidario p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Leitura rápida</p>
              <p className="text-sm text-foreground">
                {occupancyRate >= 80
                  ? "Sua agenda está com boa ocupação para os próximos 14 dias."
                  : occupancyRate >= 50
                    ? "A ocupação está estável, com margem para novos encaixes."
                    : "Há espaço para abrir novas reservas e equilibrar a agenda."}
              </p>
              <p className="text-xs text-muted-foreground">
                Ajustes de disponibilidade podem ser feitos no perfil já configurado.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <KidarioButton asChild variant="outline" fullWidth>
                <Link to={TEACHER_AGENDA_PATH}>Ver agenda</Link>
              </KidarioButton>
              <KidarioButton asChild variant="outline" fullWidth>
                <Link to="/perfil">Ir para perfil</Link>
              </KidarioButton>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}
