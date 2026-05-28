import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Landmark, TicketPercent } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { TeacherBookingHeaderCard } from "@/components/booking/TeacherBookingHeaderCard";
import { PaymentMethodOption } from "@/components/booking/PaymentMethodOption";
import { BookingModality, formatDateLong } from "@/lib/bookingUtils";
import { createBooking, type PaymentMethod } from "@/data/api/bookings";
import { useToast } from "@/hooks/use-toast";
import { getExploreTeacherDetail, type ExplorePackagePlan } from "@/data/api/explore";
import { type Teacher } from "@/components/explore/TeacherCard";
import { createPackagePurchase } from "@/data/api/packages";
import {
  getParentProfile,
  type BackendParentChildView,
} from "@/data/api/parentProfiles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const couponDiscounts: Record<string, number> = {
  KIDARIO10: 0.1,
};

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryChildId = searchParams.get("childId") || "";

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [isLoadingTeacher, setIsLoadingTeacher] = useState(false);
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(60);
  const authSession = getAuthSession();

  const dateIso = searchParams.get("date") ?? "";
  const time = searchParams.get("time") ?? "";
  const packagePlanId = searchParams.get("packagePlanId") ?? "";
  const modalityQuery = searchParams.get("modality");

  const modality: BookingModality = modalityQuery === "presencial" ? "presencial" : "online";

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [children, setChildren] = useState<BackendParentChildView[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(queryChildId);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [packagePlans, setPackagePlans] = useState<ExplorePackagePlan[]>([]);

  useEffect(() => {
    if (!id) {
      setTeacher(null);
      setLessonDurationMinutes(60);
      setPackagePlans([]);
      return;
    }

    setTeacher(null);
    setIsLoadingTeacher(true);

    let isMounted = true;
    getExploreTeacherDetail(id)
      .then((detail) => {
        if (!isMounted) return;
        setTeacher(detail.teacher);
        setLessonDurationMinutes(detail.lessonDurationMinutes > 0 ? detail.lessonDurationMinutes : 60);
        setPackagePlans(detail.packagePlans);
      })
      .catch(() => {})
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingTeacher(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!authSession.isAuthenticated) {
      setChildren([]);
      return;
    }

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setChildren([]);
      return;
    }

    let isMounted = true;
    setIsLoadingChildren(true);

    getParentProfile(accessToken)
      .then((payload) => {
        if (!isMounted) return;
        const nextChildren = payload.children || [];
        setChildren(nextChildren);
        setSelectedChildId((current) => {
          if (current && nextChildren.some((child) => child.id === current)) return current;
          if (queryChildId && nextChildren.some((child) => child.id === queryChildId)) return queryChildId;
          if (nextChildren.length === 1) return nextChildren[0].id;
          return "";
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setChildren([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingChildren(false);
      });

    return () => {
      isMounted = false;
    };
  }, [authSession.isAuthenticated, queryChildId]);

  const selectedPackagePlan = useMemo(
    () => packagePlans.find((plan) => plan.id === packagePlanId) || null,
    [packagePlanId, packagePlans],
  );

  const basePrice = useMemo(() => {
    if (selectedPackagePlan) {
      return Math.round(
        (selectedPackagePlan.estimated_final_amount_cents
          ?? selectedPackagePlan.estimated_original_amount_cents
          ?? 0) / 100,
      );
    }
    if (!teacher) return 0;
    return Math.round(teacher.pricePerClass * (lessonDurationMinutes / 60));
  }, [lessonDurationMinutes, selectedPackagePlan, teacher]);

  const discountRate = appliedCoupon ? couponDiscounts[appliedCoupon] ?? 0 : 0;
  const discountValue = Math.round(basePrice * discountRate);
  const totalPrice = Math.max(basePrice - discountValue, 0);
  const dateLabel = formatDateLong(dateIso);
  const requiresChildSelection = authSession.isAuthenticated;
  const selectedChildName =
    children.find((child) => child.id === selectedChildId)?.name
    || (authSession.isAuthenticated ? "Não selecionado" : "Definido após login");

  const isPackageCheckout = Boolean(selectedPackagePlan);
  const isPayloadValid = Boolean(
    teacher && (isPackageCheckout || (dateIso && time && lessonDurationMinutes > 0)),
  );

  const handleApplyCoupon = () => {
    const normalized = couponInput.trim().toUpperCase();
    if (!normalized) return;

    if (!couponDiscounts[normalized]) {
      setCouponError("Cupom inválido para este MVP.");
      setAppliedCoupon("");
      return;
    }

    setCouponError("");
    setAppliedCoupon(normalized);
  };

  const handleConfirmBooking = async () => {
    if (!isPayloadValid || !teacher) return;

    if (!authSession.isAuthenticated) {
      const returnTo = `/checkout/${teacher.id}?${searchParams.toString()}`;
      navigate(`/login?role=parent&returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    setIsSubmitting(true);

    if (requiresChildSelection && !selectedChildId) {
      setIsSubmitting(false);
      toast({
        title: "Selecione a criança",
        description: "Defina para qual filho esta aula será agendada.",
      });
      return;
    }

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setIsSubmitting(false);
      toast({
        title: "Sessão inválida",
        description: "Faça login novamente para concluir o agendamento.",
      });
      return;
    }

    try {
      if (selectedPackagePlan) {
        await createPackagePurchase(accessToken, {
          package_plan_id: selectedPackagePlan.id,
          child_id: selectedChildId,
          payment_method: paymentMethod,
        });
        toast({
          title: "Pacote comprado",
          description: "O pacote ficará disponível para agendar aulas com esta professora.",
        });
        navigate("/agenda");
        return;
      }

      const response = await createBooking(accessToken, {
        teacher_id: teacher.id,
        child_id: selectedChildId,
        starts_at: composeStartsAt(dateIso, time),
        duration_minutes: lessonDurationMinutes,
        modality,
        payment_method: paymentMethod,
      });

      navigate(`/confirmacao-reserva/${response.booking_id}`);
      return;
    } catch (error) {
      setIsSubmitting(false);
      toast({
        title: "Não foi possível concluir no backend",
        description:
          error instanceof Error
            ? error.message
            : "Tente novamente em alguns instantes.",
      });
    }
  };

  if (!isPayloadValid || !teacher) {
    return (
      <AppShell hideNav>
        <TopBar title="Checkout" showBack />
        <div className="px-4 pt-10">
          <div className="card-kidario p-6 text-center">
            <p className="text-foreground font-medium">
              {isLoadingTeacher ? "Carregando dados da professora..." : "Dados da reserva incompletos."}
            </p>
            <Link to="/explorar" className="text-primary text-sm font-medium hover:underline mt-3 inline-block">
              Voltar para explorar
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <TopBar title="Checkout" showBack />

      <div className="px-4 pt-6 pb-8 space-y-6">
        <TeacherBookingHeaderCard
          teacherName={teacher.name}
          teacherAvatar={teacher.avatar}
          specialty={teacher.specialties[0]}
          pricePerHour={teacher.pricePerClass}
        />

        <BookingSummaryCard
          title={selectedPackagePlan ? "Resumo do pacote" : "Resumo da reserva"}
          rows={
            selectedPackagePlan
              ? [
                  { label: "Filho(a):", value: selectedChildName },
                  { label: "Pacote:", value: selectedPackagePlan.name },
                  { label: "Aulas:", value: `${selectedPackagePlan.sessions_count}` },
                  { label: "Desconto:", value: `${selectedPackagePlan.discount_percent}%` },
                ]
              : [
                  { label: "Filho(a):", value: selectedChildName },
                  { label: "Data:", value: dateLabel },
                  { label: "Horário:", value: `${time} (${lessonDurationMinutes} min)` },
                  { label: "Modalidade:", value: modality === "online" ? "Online" : "Presencial" },
                ]
          }
        />

        {authSession.isAuthenticated && (
          <section className="card-kidario p-4 space-y-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Aluno da aula</h2>
            {isLoadingChildren ? (
              <p className="text-sm text-muted-foreground">Carregando alunos...</p>
            ) : children.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma criança cadastrada. Complete o cadastro no perfil de responsável.
              </p>
            ) : (
              <Select value={selectedChildId} onValueChange={setSelectedChildId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a criança" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </section>
        )}

        <section className="card-kidario p-4 space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">Cupom</h2>
          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Digite seu cupom"
              className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <KidarioButton type="button" variant="outline" size="default" onClick={handleApplyCoupon}>
              <TicketPercent className="w-4 h-4" />
              Aplicar
            </KidarioButton>
          </div>
          {couponError && <p className="text-xs text-destructive">{couponError}</p>}
          {appliedCoupon && (
            <p className="text-xs text-success">Cupom {appliedCoupon} aplicado com sucesso.</p>
          )}
        </section>

        <section className="card-kidario p-4 space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">Forma de pagamento</h2>

          {/* <PaymentMethodOption
            disabled={true}
            title="Cartao"
            description="Confirma em poucos segundos."
            icon={<CreditCard className="w-4 h-4" />}
            selected={paymentMethod === "cartao"}
            onSelect={() => setPaymentMethod("cartao")}
          /> */}

          <PaymentMethodOption
            title="Pix"
            description="A reserva fica pendente até a confirmação do pagamento."
            icon={<Landmark className="w-4 h-4" />}
            selected={paymentMethod === "pix"}
            onSelect={() => setPaymentMethod("pix")}
          />
        </section>

        <section className="card-kidario p-4 space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">Política de cancelamento</h2>
          <p className="text-sm text-muted-foreground">
            Cancelamentos com menos de 6 horas de antecedência podem ter cobrança parcial.
          </p>
        </section>

        {!authSession.isAuthenticated && (
          <section className="card-kidario p-4 bg-warning/5 border-warning/30">
            <p className="text-sm text-foreground">
              Para concluir o pagamento, entre na sua conta de responsável.
            </p>
          </section>
        )}

        <section className="card-kidario p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">R$ {basePrice}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Desconto</span>
            <span className="text-foreground">- R$ {discountValue}</span>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="font-display text-lg font-semibold text-foreground">Total</span>
            <span className="font-display text-lg font-semibold text-primary">R$ {totalPrice}</span>
          </div>
        </section>

        <KidarioButton
          variant="hero"
          size="xl"
          fullWidth
          onClick={handleConfirmBooking}
          disabled={isSubmitting || (requiresChildSelection && !selectedChildId)}
        >
          {isSubmitting
            ? "Processando..."
            : authSession.isAuthenticated
              ? selectedPackagePlan
                ? "Comprar pacote"
                : "Pagar e agendar"
              : "Entrar para continuar"}
        </KidarioButton>
      </div>
    </AppShell>
  );
}

function composeStartsAt(dateIso: string, time: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
  return date.toISOString();
}
