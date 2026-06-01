import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Barcode, CreditCard, Landmark, TicketPercent } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { TeacherBookingHeaderCard } from "@/components/booking/TeacherBookingHeaderCard";
import { PaymentMethodOption } from "@/components/booking/PaymentMethodOption";
import { PaymentInstructionsCard } from "@/components/booking/PaymentInstructionsCard";
import { BookingModality, formatDateLong } from "@/lib/bookingUtils";
import { createBooking, type PaymentMethod } from "@/data/api/bookings";
import { useToast } from "@/hooks/use-toast";
import { getExploreTeacherDetail, type ExplorePackagePlan } from "@/data/api/explore";
import { type Teacher } from "@/components/explore/TeacherCard";
import { createPackagePurchase, listParentPackages, type BookingPackage } from "@/data/api/packages";
import { tokenizePagarmeCard } from "@/data/api/pagarmeTokenization";
import {
  CARD_EXPIRATION_MONTH_OPTIONS,
  buildCardExpirationYearOptions,
  detectCardBrand,
  formatCardCvv,
  formatCardNumber,
  isFutureCardExpirationYear,
  isValidCardExpirationMonth,
} from "@/lib/cardBrand";
import {
  getParentProfile,
  type BackendParentChildView,
} from "@/data/api/parentProfiles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateParentCheckoutTotalCents, calculateParentServiceFeeCents, formatCurrencyCents } from "@/lib/pricing";

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
  const packageId = searchParams.get("packageId") ?? "";
  const modalityQuery = searchParams.get("modality");

  const modality: BookingModality = modalityQuery === "presencial" ? "presencial" : "online";

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardExpMonth, setCardExpMonth] = useState("");
  const [cardExpYear, setCardExpYear] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [installments, setInstallments] = useState(1);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [children, setChildren] = useState<BackendParentChildView[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(queryChildId);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [packagePlans, setPackagePlans] = useState<ExplorePackagePlan[]>([]);
  const [parentPackages, setParentPackages] = useState<BookingPackage[]>([]);
  const [createdPackage, setCreatedPackage] = useState<BookingPackage | null>(null);

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

  useEffect(() => {
    if (!authSession.isAuthenticated || !packageId) {
      setParentPackages([]);
      return;
    }

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setParentPackages([]);
      return;
    }

    let isMounted = true;

    listParentPackages(accessToken)
      .then((response) => {
        if (!isMounted) return;
        setParentPackages(response.packages || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setParentPackages([]);
      });

    return () => {
      isMounted = false;
    };
  }, [authSession.isAuthenticated, packageId]);

  const selectedPackagePlan = useMemo(
    () => packagePlans.find((plan) => plan.id === packagePlanId) || null,
    [packagePlanId, packagePlans],
  );
  const selectedActivePackage = useMemo(
    () =>
      parentPackages.find(
        (bookingPackage) =>
          bookingPackage.id === packageId
          && bookingPackage.child_id === selectedChildId
          && bookingPackage.teacher_id === teacher?.id
          && bookingPackage.status === "active"
          && bookingPackage.remaining_sessions > 0,
      ) || null,
    [packageId, parentPackages, selectedChildId, teacher?.id],
  );
  const cardBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);
  const cardExpirationYears = useMemo(() => buildCardExpirationYearOptions(), []);

  const basePriceCents = useMemo(() => {
    if (selectedActivePackage) return 0;
    if (selectedPackagePlan) {
      return selectedPackagePlan.estimated_final_amount_cents
        ?? selectedPackagePlan.estimated_original_amount_cents
        ?? 0;
    }
    if (!teacher) return 0;
    return teacher.pricePerClassCents ?? Math.round(teacher.pricePerClass * 100);
  }, [selectedActivePackage, selectedPackagePlan, teacher]);

  const discountRate = appliedCoupon ? couponDiscounts[appliedCoupon] ?? 0 : 0;
  const discountValueCents = Math.round(basePriceCents * discountRate);
  const subtotalCents = Math.max(basePriceCents - discountValueCents, 0);
  const platformServiceFeeCents = calculateParentServiceFeeCents(subtotalCents);
  const totalPriceCents = calculateParentCheckoutTotalCents(subtotalCents);
  const dateLabel = formatDateLong(dateIso);
  const requiresChildSelection = authSession.isAuthenticated;
  const selectedChildName =
    children.find((child) => child.id === selectedChildId)?.name
    || (authSession.isAuthenticated ? "Não selecionado" : "Definido após login");

  const isPackagePurchaseCheckout = Boolean(selectedPackagePlan);
  const isPackageSessionCheckout = Boolean(packageId);
  const baseAmountLabel = isPackagePurchaseCheckout
    ? "Valor do pacote"
    : isPackageSessionCheckout
      ? "Aula do pacote"
      : "Valor da aula";
  const isPayloadValid = Boolean(
    teacher
      && (
        isPackagePurchaseCheckout
        || (isPackageSessionCheckout
          ? selectedActivePackage && dateIso && time && lessonDurationMinutes > 0
          : dateIso && time && lessonDurationMinutes > 0)
      ),
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

    if (
      !isPackageSessionCheckout
      && paymentMethod === "credit_card"
      && (!cardNumber.trim() || !cardHolderName.trim() || !cardExpMonth.trim() || !cardExpYear.trim() || !cardCvv.trim())
    ) {
      setIsSubmitting(false);
      toast({
        title: "Dados do cartão incompletos",
        description: "Preencha os dados do cartão para continuar.",
      });
      return;
    }

    if (
      !isPackageSessionCheckout
      && paymentMethod === "credit_card"
      && (!isValidCardExpirationMonth(cardExpMonth) || !isFutureCardExpirationYear(cardExpYear))
    ) {
      setIsSubmitting(false);
      toast({
        title: "Validade do cartão inválida",
        description: "Informe um mês entre 01 e 12 e um ano maior que o ano atual.",
      });
      return;
    }

    if (isPackageSessionCheckout && !selectedActivePackage) {
      setIsSubmitting(false);
      toast({
        title: "Pacote indisponível",
        description: "Selecione um pacote ativo para esta criança e professora.",
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
      const cardPaymentReference =
        !isPackageSessionCheckout && paymentMethod === "credit_card"
          ? {
              card_token: await tokenizePagarmeCard({
                number: cardNumber,
                holderName: cardHolderName,
                expMonth: cardExpMonth,
                expYear: cardExpYear,
                cvv: cardCvv,
              }),
            }
          : {};

      if (selectedPackagePlan) {
        const packagePurchase = await createPackagePurchase(accessToken, {
          package_plan_id: selectedPackagePlan.id,
          child_id: selectedChildId,
          payment_method: paymentMethod,
          ...(paymentMethod === "credit_card"
            ? { ...cardPaymentReference, installments }
            : {}),
        });
        toast({
          title: "Pacote comprado",
          description: "O pacote ficará disponível para agendar aulas com esta professora.",
        });
        if (paymentMethod === "credit_card" || packagePurchase.status === "active") {
          navigate("/agenda");
          return;
        }
        setCreatedPackage(packagePurchase);
        setIsSubmitting(false);
        return;
      }

      const response = await createBooking(accessToken, {
        teacher_id: teacher.id,
        child_id: selectedChildId,
        starts_at: composeStartsAt(dateIso, time),
        duration_minutes: lessonDurationMinutes,
        modality,
        ...(selectedActivePackage
          ? { package_id: selectedActivePackage.id }
          : { payment_method: paymentMethod }),
        ...(!isPackageSessionCheckout && paymentMethod === "credit_card"
          ? { ...cardPaymentReference, installments }
          : {}),
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

  if (createdPackage && teacher) {
    const packagePaymentOrder = createdPackage.payment_order || null;
    const packagePaymentCharge = packagePaymentOrder?.charges?.[0] || null;

    return (
      <AppShell hideNav>
        <TopBar title="Pacote comprado" showBack />
        <div className="px-4 pt-6 pb-8 space-y-6">
          <TeacherBookingHeaderCard
            teacherName={teacher.name}
            teacherAvatar={teacher.avatar}
            specialty={teacher.specialties[0]}
            pricePerHour={teacher.pricePerClass}
          />

          <BookingSummaryCard
            title="Resumo do pacote"
            rows={[
              { label: "Filho(a):", value: selectedChildName },
              { label: "Pacote:", value: selectedPackagePlan?.name || "Pacote de aulas" },
              { label: "Aulas:", value: `${createdPackage.total_sessions}` },
              { label: "Status:", value: packageStatusLabel(createdPackage.status) },
            ]}
            totalLabel="Total"
            totalValue={formatCurrencyCents(packagePaymentOrder?.amount_cents || createdPackage.final_amount_cents)}
          />

          <PaymentInstructionsCard
            paymentOrder={packagePaymentOrder}
            paymentCharge={packagePaymentCharge}
            subjectLabel="pacote"
          />

          <KidarioButton asChild variant="hero" size="lg" fullWidth>
            <Link to="/agenda">Ir para agenda</Link>
          </KidarioButton>
        </div>
      </AppShell>
    );
  }

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
          title={isPackagePurchaseCheckout ? "Resumo do pacote" : "Resumo da reserva"}
          rows={
            isPackagePurchaseCheckout && selectedPackagePlan
              ? [
                  { label: "Filho(a):", value: selectedChildName },
                  { label: "Pacote:", value: selectedPackagePlan.name },
                  { label: "Aulas:", value: `${selectedPackagePlan.sessions_count}` },
                  { label: "Desconto:", value: `${selectedPackagePlan.discount_percent}%` },
                ]
              : isPackageSessionCheckout
                ? [
                    { label: "Filho(a):", value: selectedChildName },
                    { label: "Pacote:", value: "Pacote ativo" },
                    { label: "Restantes:", value: selectedActivePackage ? `${selectedActivePackage.remaining_sessions}` : "-" },
                    { label: "Data:", value: dateLabel },
                    { label: "Horário:", value: `${time} (${lessonDurationMinutes} min)` },
                    { label: "Modalidade:", value: modality === "online" ? "Online" : "Presencial" },
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

        {!isPackageSessionCheckout && (
          <>
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

              <PaymentMethodOption
                title="Cartão de crédito"
                description={
                  isPackagePurchaseCheckout
                    ? "O pacote é pago no checkout."
                    : "Autoriza agora e captura apenas se a professora aceitar."
                }
                icon={<CreditCard className="w-4 h-4" />}
                selected={paymentMethod === "credit_card"}
                onSelect={() => setPaymentMethod("credit_card")}
              />

              <PaymentMethodOption
                title="Pix"
                description={
                  isPackagePurchaseCheckout
                    ? "O pacote fica ativo após a confirmação do Pix."
                    : "O Pix será gerado após a professora aceitar o horário."
                }
                icon={<Landmark className="w-4 h-4" />}
                selected={paymentMethod === "pix"}
                onSelect={() => setPaymentMethod("pix")}
              />

              <PaymentMethodOption
                title="Boleto"
                description={
                  isPackagePurchaseCheckout
                    ? "O pacote fica ativo após a compensação."
                    : "O boleto será gerado após a professora aceitar o horário."
                }
                icon={<Barcode className="w-4 h-4" />}
                selected={paymentMethod === "boleto"}
                onSelect={() => setPaymentMethod("boleto")}
              />

              {paymentMethod === "credit_card" && (
                <div className="rounded-xl border border-border/70 p-3 space-y-3">
                  <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground" htmlFor="card-number">
                    Número do cartão
                  </label>
                  <div className="relative">
                    <input
                      id="card-number"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      maxLength={19}
                      pattern="[0-9 ]*"
                      value={cardNumber}
                      onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
                      placeholder="0000 0000 0000 0000"
                      className="w-full h-11 pl-4 pr-28 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>{cardBrand?.label || "Bandeira"}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground" htmlFor="card-holder-name">
                    Nome impresso
                  </label>
                  <input
                    id="card-holder-name"
                    autoComplete="cc-name"
                    value={cardHolderName}
                    onChange={(event) => setCardHolderName(event.target.value)}
                    placeholder="Nome do titular"
                    className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0 space-y-1">
                    <label className="text-sm font-medium text-foreground" htmlFor="card-exp-month">
                      MM
                    </label>
                    <select
                      id="card-exp-month"
                      autoComplete="cc-exp-month"
                      value={cardExpMonth}
                      onChange={(event) => setCardExpMonth(event.target.value)}
                      className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      <option value="" disabled>
                        MM
                      </option>
                      {CARD_EXPIRATION_MONTH_OPTIONS.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <label className="text-sm font-medium text-foreground" htmlFor="card-exp-year">
                      AAAA
                    </label>
                    <select
                      id="card-exp-year"
                      autoComplete="cc-exp-year"
                      value={cardExpYear}
                      onChange={(event) => setCardExpYear(event.target.value)}
                      className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      <option value="" disabled>
                        AAAA
                      </option>
                      {cardExpirationYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <label className="text-sm font-medium text-foreground" htmlFor="card-cvv">
                      CVV
                    </label>
                    <input
                      id="card-cvv"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={4}
                      pattern="[0-9]*"
                      type="password"
                      value={cardCvv}
                      onChange={(event) => setCardCvv(formatCardCvv(event.target.value))}
                      placeholder="123"
                      className="w-full h-11 px-4 bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <label className="text-sm font-medium text-foreground" htmlFor="installments">
                      Parcelas
                    </label>
                    <select
                      id="installments"
                      value={installments}
                      onChange={(event) => setInstallments(Number(event.target.value))}
                      className="w-full h-11 px-3 bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((option) => (
                        <option key={option} value={option}>
                          {option}x
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
          </>
        )}

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
            <span className="text-muted-foreground">{baseAmountLabel}</span>
            <span className="text-foreground">{formatCurrencyCents(basePriceCents)}</span>
          </div>
          {!isPackageSessionCheckout && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Desconto</span>
                <span className="text-foreground">- {formatCurrencyCents(discountValueCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa de uso da plataforma (8%)</span>
                <span className="text-foreground">{formatCurrencyCents(platformServiceFeeCents)}</span>
              </div>
            </>
          )}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="font-display text-lg font-semibold text-foreground">Total</span>
            <span className="font-display text-lg font-semibold text-primary">{formatCurrencyCents(totalPriceCents)}</span>
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
                : isPackageSessionCheckout
                  ? "Solicitar com pacote"
                : paymentMethod === "credit_card"
                  ? "Autorizar cartão e solicitar"
                  : "Solicitar agendamento"
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

function packageStatusLabel(status: BookingPackage["status"]) {
  const labels: Record<BookingPackage["status"], string> = {
    pending_payment: "Aguardando pagamento",
    active: "Ativo",
    completed: "Concluído",
    canceled: "Cancelado",
    expired: "Expirado",
  };
  return labels[status] || status;
}
