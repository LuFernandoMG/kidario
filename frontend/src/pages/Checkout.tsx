import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CreditCard, Landmark, TicketPercent } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { getTeacherById } from "@/data/mockTeachers";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import { appendStoredBooking } from "@/lib/bookingsStorage";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { TeacherBookingHeaderCard } from "@/components/booking/TeacherBookingHeaderCard";
import { PaymentMethodOption } from "@/components/booking/PaymentMethodOption";
import { BookingModality, formatDateLong } from "@/lib/bookingUtils";
import { createBooking } from "@/lib/backendBookings";
import { useToast } from "@/hooks/use-toast";
import { getMarketplaceTeacherDetail } from "@/lib/backendMarketplace";
import { type Teacher } from "@/components/marketplace/TeacherCard";
import {
  getParentProfile,
  type BackendParentChildView,
} from "@/domains/parent/api/backendParentProfiles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PaymentMethod = "cartao" | "pix";

const couponDiscounts: Record<string, number> = {
  KIDARIO10: 0.1,
};

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryChildId = searchParams.get("childId") || "";

  const [teacher, setTeacher] = useState<Teacher | null>(() => (id ? getTeacherById(id) ?? null : null));
  const [isLoadingTeacher, setIsLoadingTeacher] = useState(false);
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(60);
  const authSession = getAuthSession();

  const dateIso = searchParams.get("date") ?? "";
  const time = searchParams.get("time") ?? "";
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

  useEffect(() => {
    if (!id) {
      setTeacher(null);
      setLessonDurationMinutes(60);
      return;
    }

    const localTeacher = getTeacherById(id) ?? null;
    setTeacher(localTeacher);
    setIsLoadingTeacher(true);

    let isMounted = true;
    getMarketplaceTeacherDetail(id)
      .then((detail) => {
        if (!isMounted) return;
        setTeacher(detail.teacher);
        setLessonDurationMinutes(detail.lessonDurationMinutes > 0 ? detail.lessonDurationMinutes : 60);
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

  const basePrice = useMemo(() => {
    if (!teacher) return 0;
    return Math.round(teacher.pricePerClass * (lessonDurationMinutes / 60));
  }, [lessonDurationMinutes, teacher]);

  const discountRate = appliedCoupon ? couponDiscounts[appliedCoupon] ?? 0 : 0;
  const discountValue = Math.round(basePrice * discountRate);
  const totalPrice = Math.max(basePrice - discountValue, 0);
  const dateLabel = formatDateLong(dateIso);
  const requiresChildSelection = authSession.isAuthenticated && children.length > 0;
  const selectedChildName =
    children.find((child) => child.id === selectedChildId)?.name
    || (authSession.isAuthenticated ? "Não selecionado" : "Definido após login");

  const isPayloadValid = Boolean(teacher && dateIso && time && lessonDurationMinutes > 0);

  const handleApplyCoupon = () => {
    const normalized = couponInput.trim().toUpperCase();
    if (!normalized) return;

    if (!couponDiscounts[normalized]) {
      setCouponError("Cupom invalido para este MVP.");
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
    const canUseBackendBooking = Boolean(accessToken && isUuidLike(teacher.id));

    if (canUseBackendBooking && accessToken) {
      try {
        const response = await createBooking(accessToken, {
          teacher_profile_id: teacher.id,
          child_id: selectedChildId || undefined,
          date_iso: dateIso,
          time,
          duration_minutes: lessonDurationMinutes,
          modality,
          payment_method: paymentMethod,
          coupon_code: appliedCoupon || undefined,
        });

        appendStoredBooking({
          id: response.booking_id,
          teacherId: teacher.id,
          teacherName: teacher.name,
          teacherAvatar: teacher.avatar,
          specialty: teacher.specialties[0] ?? "Apoio pedagogico",
          dateLabel,
          dateIso,
          time,
          modality,
          status: response.booking_status,
          createdAtIso: new Date().toISOString(),
          updatedAtIso: new Date().toISOString(),
        });

        navigate(`/confirmacao-reserva/${response.booking_id}`);
        return;
      } catch (error) {
        setIsSubmitting(false);
        toast({
          title: "Nao foi possivel concluir no backend",
          description:
            error instanceof Error
              ? error.message
              : "Tente novamente em alguns instantes.",
        });
        return;
      }
    }

    const bookingId = getBookingId();
    const bookingStatus = "pendente";

    setTimeout(() => {
      appendStoredBooking({
        id: bookingId,
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherAvatar: teacher.avatar,
        specialty: teacher.specialties[0] ?? "Apoio pedagogico",
        dateLabel,
        dateIso,
        time,
        modality,
        status: bookingStatus,
        createdAtIso: new Date().toISOString(),
      });

      navigate(`/confirmacao-reserva/${bookingId}`);
    }, 700);
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
          title="Resumo da reserva"
          rows={[
            { label: "Filho(a):", value: selectedChildName },
            { label: "Data:", value: dateLabel },
            { label: "Horario:", value: `${time} (${lessonDurationMinutes} min)` },
            { label: "Modalidade:", value: modality === "online" ? "Online" : "Presencial" },
          ]}
        />

        {authSession.isAuthenticated && (
          <section className="card-kidario p-4 space-y-3">
            <h2 className="font-display text-lg font-semibold text-foreground">Criança da aula</h2>
            {isLoadingChildren ? (
              <p className="text-sm text-muted-foreground">Carregando crianças...</p>
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
            description="Reserva fica pendente ate a confirmacao do pagamento."
            icon={<Landmark className="w-4 h-4" />}
            selected={paymentMethod === "pix"}
            onSelect={() => setPaymentMethod("pix")}
          />
        </section>

        <section className="card-kidario p-4 space-y-2">
          <h2 className="font-display text-lg font-semibold text-foreground">Politica de cancelamento</h2>
          <p className="text-sm text-muted-foreground">
            Cancelamentos com menos de 6 horas de antecedencia podem ter cobranca parcial.
          </p>
        </section>

        {!authSession.isAuthenticated && (
          <section className="card-kidario p-4 bg-warning/5 border-warning/30">
            <p className="text-sm text-foreground">
              Para concluir o pagamento, entre na sua conta de responsavel.
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
              ? "Pagar e agendar"
              : "Entrar para continuar"}
        </KidarioButton>
      </div>
    </AppShell>
  );
}

function getBookingId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
