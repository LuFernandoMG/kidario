import { Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { TEACHER_AGENDA_PATH, TEACHER_PLANNING_PATH } from "@/domains/teacher/lib/teacherRoutes";
import { useTeacherControlCenterOverview } from "@/domains/teacher/query/teacherControlQueries";

export default function TeacherFinancePage() {
  const overviewQuery = useTeacherControlCenterOverview({
    limitAgenda: 6,
    limitChats: 6,
    limitStudents: 6,
  });

  const finance = overviewQuery.data?.finance;
  const averageTicket = finance
    ? finance.completed_lessons_count > 0
      ? finance.gross_revenue_total / finance.completed_lessons_count
      : 0
    : 0;
  const paidRatePercent = finance
    ? finance.completed_lessons_count > 0
      ? (finance.paid_lessons_count / finance.completed_lessons_count) * 100
      : 0
    : 0;

  return (
    <AppShell>
      <TopBar title="Receitas e Pagamentos" />
      <div className="px-4 pt-4 pb-8 space-y-3">
        {overviewQuery.isLoading ? (
          <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando dados financeiros...</div>
        ) : overviewQuery.isError ? (
          <div className="card-kidario p-4 text-sm text-destructive">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "Não foi possível carregar o financeiro."}
          </div>
        ) : finance ? (
          <>
            <FinanceCard
              title="Receita bruta (aulas concluídas)"
              value={formatCurrency(finance.gross_revenue_total, finance.currency)}
            />
            <FinanceCard
              title="Total recebido"
              value={formatCurrency(finance.paid_total, finance.currency)}
            />
            <FinanceCard
              title="Pagamentos pendentes"
              value={formatCurrency(finance.pending_payment_total, finance.currency)}
            />
            <div className="grid grid-cols-2 gap-3">
              <FinanceCard title="Aulas concluídas" value={String(finance.completed_lessons_count)} />
              <FinanceCard title="Aulas pagas" value={String(finance.paid_lessons_count)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FinanceCard
                title="Ticket médio"
                value={formatCurrency(averageTicket, finance.currency)}
              />
              <FinanceCard
                title="Taxa de pagamento"
                value={formatPercent(paidRatePercent)}
              />
            </div>

            <div className="card-kidario p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Próximos passos</p>
              <p className="text-sm text-foreground">
                Use a agenda para acompanhar confirmações e o planejamento para ajustar oferta de horários.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <KidarioButton asChild variant="outline" fullWidth>
                  <Link to={TEACHER_AGENDA_PATH}>Ver agenda</Link>
                </KidarioButton>
                <KidarioButton asChild variant="outline" fullWidth>
                  <Link to={TEACHER_PLANNING_PATH}>Ver planejamento</Link>
                </KidarioButton>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function FinanceCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="card-kidario p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}
