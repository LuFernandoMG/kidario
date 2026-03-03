import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppShell } from "@/components/layout/AppShell";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import {
  type AdminDashboardResponse,
  type AdminTeacherRecord,
  getAdminDashboard,
  patchTeacherActivation,
} from "@/lib/backendAdmin";
import { ADMIN_HIDDEN_DASHBOARD_PATH } from "@/lib/privateRoutes";

const bookingStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  concluida: "Concluída",
};

const paymentStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  falhou: "Falhou",
};

const paymentMethodLabel: Record<string, string> = {
  cartao: "Cartão",
  pix: "Pix",
};

interface DetailModalState {
  open: boolean;
  title: string;
  description: string;
  items: string[];
  emptyLabel: string;
}

function formatCurrency(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string, time: string) {
  const date = new Date(`${value}T${time}:00`);
  if (Number.isNaN(date.getTime())) return `${value} ${time}`;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shortId(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function getBookingBadgeClass(status: string) {
  if (status === "confirmada") return "bg-success/10 text-success border-success/20";
  if (status === "pendente") return "bg-warning/10 text-warning border-warning/20";
  if (status === "cancelada") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-muted text-muted-foreground border-border";
}

function getPaymentBadgeClass(status: string) {
  if (status === "pago") return "bg-success/10 text-success border-success/20";
  if (status === "falhou") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-warning/10 text-warning border-warning/20";
}

export default function AdminHiddenDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const authSession = getAuthSession();
  const accessToken = getSupabaseAccessToken();
  const [pendingTeacherId, setPendingTeacherId] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    open: false,
    title: "",
    description: "",
    items: [],
    emptyLabel: "",
  });

  useEffect(() => {
    if (authSession.isAuthenticated && accessToken) return;

    navigate(`/login?returnTo=${encodeURIComponent(ADMIN_HIDDEN_DASHBOARD_PATH)}`, { replace: true });
  }, [accessToken, authSession.isAuthenticated, navigate]);

  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      if (!accessToken) throw new Error("Sessão inválida. Faça login novamente.");
      return getAdminDashboard(accessToken);
    },
    enabled: authSession.isAuthenticated && Boolean(accessToken),
  });

  const activationMutation = useMutation({
    mutationFn: async (params: { profileId: string; nextValue: boolean }) => {
      if (!accessToken) throw new Error("Sessão inválida. Faça login novamente.");
      return patchTeacherActivation(accessToken, params.profileId, params.nextValue);
    },
    onSuccess: (response) => {
      queryClient.setQueryData<AdminDashboardResponse>(["admin", "dashboard"], (current) => {
        if (!current) return current;

        return {
          ...current,
          teachers: current.teachers.map((teacher) => (
            teacher.profile_id === response.profile_id
              ? { ...teacher, is_active_teacher: response.is_active_teacher }
              : teacher
          )),
        };
      });
    },
  });

  async function handleToggleTeacherActivation(teacher: AdminTeacherRecord) {
    setPendingTeacherId(teacher.profile_id);
    try {
      const nextValue = !teacher.is_active_teacher;
      await activationMutation.mutateAsync({ profileId: teacher.profile_id, nextValue });
      toast({
        title: nextValue ? "Professora aceita" : "Professora reprovada",
        description: "Status atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível atualizar",
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setPendingTeacherId((current) => (current === teacher.profile_id ? null : current));
    }
  }

  function openDetailModal(params: {
    title: string;
    description: string;
    items?: string[];
    emptyLabel: string;
  }) {
    setDetailModal({
      open: true,
      title: params.title,
      description: params.description,
      items: params.items || [],
      emptyLabel: params.emptyLabel,
    });
  }

  const data = dashboardQuery.data;

  return (
    <AppShell hideNav className="bg-muted/20">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
        <header className="card-kidario mb-6 border-primary/20 bg-gradient-to-r from-card to-primary/5 p-6">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">Acesso interno</p>
          <h1 className="mt-2 font-display text-3xl text-foreground">Painel administrativo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Visualização centralizada de registros de professoras, responsáveis, agendamentos e pagamentos.
          </p>
        </header>

        {dashboardQuery.isLoading ? (
          <DashboardSkeleton />
        ) : dashboardQuery.isError ? (
          <div className="card-kidario p-4 text-sm text-destructive">
            {dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : "Não foi possível carregar o painel administrativo."}
          </div>
        ) : data ? (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Professoras" value={data.teachers.length} />
              <SummaryCard label="Responsáveis" value={data.parents.length} />
              <SummaryCard label="Agendamentos" value={data.bookings.length} />
              <SummaryCard label="Pagamentos" value={data.payments.length} />
            </section>

            <Tabs defaultValue="teachers" className="space-y-4">
              <TabsList className="grid h-auto w-full max-w-[760px] grid-cols-4 rounded-xl border bg-card p-1">
                <TabsTrigger value="teachers">Profesores</TabsTrigger>
                <TabsTrigger value="parents">Padres</TabsTrigger>
                <TabsTrigger value="bookings">Agendamientos</TabsTrigger>
                <TabsTrigger value="payments">Pagos</TabsTrigger>
              </TabsList>

              <TabsContent value="teachers">
                <section className="card-kidario overflow-hidden">
                  <SectionHeader
                    title="Profesores"
                    count={data.teachers.length}
                    description="Lista de professores cadastrados e status de aprovação."
                  />
                  <Table className="min-w-[1560px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Localidade</TableHead>
                        <TableHead>Modalidade</TableHead>
                        <TableHead>Formação acadêmica</TableHead>
                        <TableHead>Experiência profissional</TableHead>
                        <TableHead>Valor/hora</TableHead>
                        <TableHead>Registro</TableHead>
                        <TableHead className="text-right">Aceitação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.teachers.map((teacher) => (
                        <TableRow key={teacher.profile_id}>
                          <TableCell className="font-medium">{teacher.full_name}</TableCell>
                          <TableCell>{teacher.email}</TableCell>
                          <TableCell>{teacher.phone || "-"}</TableCell>
                          <TableCell>{[teacher.city, teacher.state].filter(Boolean).join(" / ") || "-"}</TableCell>
                          <TableCell>{teacher.modality || "-"}</TableCell>
                          <TableCell className="max-w-[300px]">
                            <TeacherDetailSummary
                              items={teacher.formations}
                              emptyLabel="Sem formação informada"
                              onViewMore={() => openDetailModal({
                                title: `Formação acadêmica de ${teacher.full_name}`,
                                description: "Histórico de formação cadastrada para esta professora.",
                                items: teacher.formations,
                                emptyLabel: "Sem formação informada.",
                              })}
                            />
                          </TableCell>
                          <TableCell className="max-w-[340px]">
                            <TeacherDetailSummary
                              items={teacher.experiences}
                              emptyLabel="Sem experiência informada"
                              onViewMore={() => openDetailModal({
                                title: `Experiência profissional de ${teacher.full_name}`,
                                description: "Histórico de experiência profissional cadastrado para esta professora.",
                                items: teacher.experiences,
                                emptyLabel: "Sem experiência profissional informada.",
                              })}
                            />
                          </TableCell>
                          <TableCell>
                            {teacher.hourly_rate != null ? formatCurrency(teacher.hourly_rate, "BRL") : "-"}
                          </TableCell>
                          <TableCell>{formatDateTime(teacher.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-2">
                              <Switch
                                checked={teacher.is_active_teacher}
                                disabled={pendingTeacherId === teacher.profile_id}
                                onCheckedChange={() => void handleToggleTeacherActivation(teacher)}
                                aria-label={`Atualizar aprovação de ${teacher.full_name}`}
                              />
                              <span
                                className={`text-xs font-medium ${
                                  teacher.is_active_teacher ? "text-success" : "text-muted-foreground"
                                }`}
                              >
                                {pendingTeacherId === teacher.profile_id
                                  ? "Salvando..."
                                  : teacher.is_active_teacher
                                    ? "Aceita"
                                    : "Pendente"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {data.teachers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-sm text-muted-foreground">
                            Sem registros de professores.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </section>
              </TabsContent>

              <TabsContent value="parents">
                <section className="card-kidario overflow-hidden">
                  <SectionHeader
                    title="Padres"
                    count={data.parents.length}
                    description="Responsáveis cadastrados e dados principais."
                  />
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Filhos</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Registro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.parents.map((parent) => (
                        <TableRow key={parent.profile_id}>
                          <TableCell className="font-medium">{parent.full_name}</TableCell>
                          <TableCell>{parent.email}</TableCell>
                          <TableCell>{parent.phone || "-"}</TableCell>
                          <TableCell>{parent.children_count}</TableCell>
                          <TableCell>{parent.address || "-"}</TableCell>
                          <TableCell>{formatDateTime(parent.created_at)}</TableCell>
                        </TableRow>
                      ))}
                      {data.parents.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                            Sem registros de responsáveis.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </section>
              </TabsContent>

              <TabsContent value="bookings">
                <section className="card-kidario overflow-hidden">
                  <SectionHeader
                    title="Agendamientos"
                    count={data.bookings.length}
                    description="Histórico de reservas com estado da aula e pagamento."
                  />
                  <Table className="min-w-[1260px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Padre</TableHead>
                        <TableHead>Profesor</TableHead>
                        <TableHead>Niño</TableHead>
                        <TableHead>Fecha/hora</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>Status aula</TableHead>
                        <TableHead>Status pago</TableHead>
                        <TableHead>Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.bookings.map((booking) => (
                        <TableRow key={booking.booking_id}>
                          <TableCell className="font-mono text-xs">{shortId(booking.booking_id)}</TableCell>
                          <TableCell>{booking.parent_name}</TableCell>
                          <TableCell>{booking.teacher_name}</TableCell>
                          <TableCell>{booking.child_name}</TableCell>
                          <TableCell>{formatDate(booking.date_iso, booking.time)}</TableCell>
                          <TableCell>{booking.duration_minutes} min</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getBookingBadgeClass(booking.booking_status)}>
                              {bookingStatusLabel[booking.booking_status] || booking.booking_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getPaymentBadgeClass(booking.payment_status)}>
                              {paymentStatusLabel[booking.payment_status] || booking.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(booking.price_total, booking.currency)}</TableCell>
                        </TableRow>
                      ))}
                      {data.bookings.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                            Sem registros de agendamentos.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </section>
              </TabsContent>

              <TabsContent value="payments">
                <section className="card-kidario overflow-hidden">
                  <SectionHeader
                    title="Pagos"
                    count={data.payments.length}
                    description="Visão financeira por reserva e status de pagamento."
                  />
                  <Table className="min-w-[1200px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reserva</TableHead>
                        <TableHead>Padre</TableHead>
                        <TableHead>Profesor</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Status pago</TableHead>
                        <TableHead>Status aula</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Atualizado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.payments.map((payment) => (
                        <TableRow key={payment.booking_id}>
                          <TableCell className="font-mono text-xs">{shortId(payment.booking_id)}</TableCell>
                          <TableCell>{payment.parent_name}</TableCell>
                          <TableCell>{payment.teacher_name}</TableCell>
                          <TableCell>{paymentMethodLabel[payment.payment_method] || payment.payment_method}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getPaymentBadgeClass(payment.payment_status)}>
                              {paymentStatusLabel[payment.payment_status] || payment.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getBookingBadgeClass(payment.booking_status)}>
                              {bookingStatusLabel[payment.booking_status] || payment.booking_status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(payment.price_total, payment.currency)}</TableCell>
                          <TableCell>{formatDateTime(payment.created_at)}</TableCell>
                          <TableCell>{formatDateTime(payment.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                      {data.payments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                            Sem registros de pagamentos.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </section>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </div>
      <Dialog
        open={detailModal.open}
        onOpenChange={(open) => setDetailModal((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailModal.title}</DialogTitle>
            <DialogDescription>{detailModal.description}</DialogDescription>
          </DialogHeader>
          {detailModal.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{detailModal.emptyLabel}</p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-2">
              {detailModal.items.map((item, index) => (
                <article key={`${item}-${index}`} className="rounded-lg border bg-muted/20 p-3 text-sm text-foreground">
                  {item}
                </article>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="card-kidario p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </article>
  );
}

function SectionHeader({ title, count, description }: { title: string; count: number; description: string }) {
  return (
    <div className="border-b px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {count}
        </Badge>
      </div>
    </div>
  );
}

function TeacherDetailSummary(
  { items, emptyLabel, onViewMore }: { items?: string[]; emptyLabel: string; onViewMore: () => void },
) {
  if (!items || items.length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyLabel}</span>;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-foreground">{items.length} registro(s)</span>
      <KidarioButton
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-lg px-2 text-xs"
        onClick={onViewMore}
      >
        Visualizar mais
      </KidarioButton>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="card-kidario p-4 space-y-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="card-kidario p-6 space-y-4">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-48 w-full" />
        </div>
      ))}
    </div>
  );
}
