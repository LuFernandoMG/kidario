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

type PaymentMethod = "cartao" | "pix";

const couponDiscounts: Record<string, number> = {
  KIDARIO10: 0.1,
};

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [teacher, setTeacher] = useState<Teacher | null>(() => (id ? getTeacherById(id) ?? null : null));
  const [isLoadingTeacher, setIsLoadingTeacher] = useState(false);
  const authSession = getAuthSession();

  const dateIso = searchParams.get("date") ?? "";
  const time = searchParams.get("time") ?? "";
  const duration = Number(searchParams.get("duration") || 60);
  const modalityQuery = searchParams.get("modality");

  const modality: BookingModality = modalityQuery === "presencial" ? "presencial" : "online";

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cartao");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [couponError, setCouponError] = useState("");

  useEffect(() => {
    if (!id) {
      setTeacher(null);
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

  const basePrice = useMemo(() => {
    if (!teacher) return 0;
    return Math.round(teacher.pricePerClass * (duration / 60));
  }, [duration, teacher]);

  const discountRate = appliedCoupon ? couponDiscounts[appliedCoupon] ?? 0 : 0;
  const discountValue = Math.round(basePrice * discountRate);
  const totalPrice = Math.max(basePrice - discountValue, 0);
  const dateLabel = formatDateLong(dateIso);

  const isPayloadValid = Boolean(teacher && dateIso && time && duration > 0);

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

    const accessToken = getSupabaseAccessToken();
    const canUseBackendBooking = Boolean(accessToken && isUuidLike(teacher.id));

    if (canUseBackendBooking && accessToken) {
      try {
        const response = await createBooking(accessToken, {
          teacher_profile_id: teacher.id,
          date_iso: dateIso,
          time,
          duration_minutes: duration,
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
    const bookingStatus = paymentMethod === "cartao" ? "confirmada" : "pendente";

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
            { label: "Data:", value: dateLabel },
            { label: "Horario:", value: `${time} (${duration} min)` },
            { label: "Modalidade:", value: modality === "online" ? "Online" : "Presencial" },
          ]}
        />

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
            title="Cartao"
            description="Confirma em poucos segundos."
            icon={<CreditCard className="w-4 h-4" />}
            selected={paymentMethod === "cartao"}
            onSelect={() => setPaymentMethod("cartao")}
          />

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

        <KidarioButton variant="hero" size="xl" fullWidth onClick={handleConfirmBooking} disabled={isSubmitting}>
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
