import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Calendar, MapPin, PackageCheck, ShoppingBag, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Chip } from "@/components/ui/Chip";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { TeacherBookingHeaderCard } from "@/components/booking/TeacherBookingHeaderCard";
import { BookingModality, DayAvailability } from "@/lib/bookingUtils";
import { type Teacher } from "@/components/explore/TeacherCard";
import { getSupabaseAccessToken } from "@/lib/authSession";
import { getTeacherAvailabilitySlots } from "@/data/api/bookings";
import { getExploreTeacherDetail, type ExplorePackagePlan } from "@/data/api/explore";
import {
  getParentProfile,
  type BackendParentChildView,
} from "@/data/api/parentProfiles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateParentCheckoutTotalCents, formatCurrencyCents } from "@/lib/pricing";
import { listParentPackages, type BookingPackage } from "@/data/api/packages";

type BookingOfferSelection = "single" | `plan:${string}` | `package:${string}`;

export default function BookingScheduler() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryChildId = searchParams.get("childId") || "";
  const queryPackagePlanId = searchParams.get("packagePlanId") || "";
  const queryPackageId = searchParams.get("packageId") || "";

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [remoteAvailability, setRemoteAvailability] = useState<DayAvailability[] | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [children, setChildren] = useState<BackendParentChildView[]>([]);
  const [selectedChildId, setSelectedChildId] = useState(queryChildId);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [lessonDurationMinutes, setLessonDurationMinutes] = useState(60);
  const [packagePlans, setPackagePlans] = useState<ExplorePackagePlan[]>([]);
  const [parentPackages, setParentPackages] = useState<BookingPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<BookingOfferSelection>("single");

  const modalities = useMemo<BookingModality[]>(() => {
    if (!teacher) return ["online"];
    const options: BookingModality[] = [];
    if (teacher.isOnline) options.push("online");
    if (teacher.isPresential) options.push("presencial");
    return options.length > 0 ? options : ["online"];
  }, [teacher]);

  const availability = useMemo<DayAvailability[]>(() => {
    if (!teacher) return [];
    if (remoteAvailability !== null) {
      return remoteAvailability;
    }
    return [];
  }, [remoteAvailability, teacher]);

  const initialDate = useMemo(() => {
    const queryDate = searchParams.get("date");
    if (queryDate && availability.some((day) => day.dateIso === queryDate)) return queryDate;
    return availability[0]?.dateIso ?? "";
  }, [availability, searchParams]);

  const [selectedModality, setSelectedModality] = useState<BookingModality>(modalities[0] ?? "online");
  const [selectedDate, setSelectedDate] = useState("");

  const timeOptions = useMemo(() => {
    const selectedDay = availability.find((day) => day.dateIso === selectedDate);
    return selectedDay?.slots ?? [];
  }, [availability, selectedDate]);

  const initialTime = useMemo(() => {
    const queryTime = searchParams.get("time");
    if (queryTime && timeOptions.includes(queryTime)) return queryTime;
    return timeOptions[0] ?? "";
  }, [searchParams, timeOptions]);

  const [selectedTime, setSelectedTime] = useState("");

  const activePackages = useMemo(() => {
    if (!teacher || !selectedChildId) return [];
    return parentPackages.filter(
      (bookingPackage) =>
        bookingPackage.teacher_id === teacher.id
        && bookingPackage.child_id === selectedChildId
        && bookingPackage.status === "active"
        && bookingPackage.remaining_sessions > 0,
    );
  }, [parentPackages, selectedChildId, teacher]);

  const selectedPackagePlanId = selectedOffer.startsWith("plan:") ? selectedOffer.slice(5) : "";
  const selectedActivePackageId = selectedOffer.startsWith("package:") ? selectedOffer.slice(8) : "";
  const selectedPackagePlan = useMemo(
    () => packagePlans.find((plan) => plan.id === selectedPackagePlanId) || null,
    [packagePlans, selectedPackagePlanId],
  );
  const selectedActivePackage = useMemo(
    () => activePackages.find((bookingPackage) => bookingPackage.id === selectedActivePackageId) || null,
    [activePackages, selectedActivePackageId],
  );

  useEffect(() => {
    if (!id) {
      setTeacher(null);
      setRemoteAvailability(null);
      setPackagePlans([]);
      setLessonDurationMinutes(60);
      setIsLoadingAvailability(false);
      return;
    }

    setTeacher(null);
    setRemoteAvailability(null);
    setPackagePlans([]);
    setIsLoadingAvailability(false);
    setIsLoadingRemote(true);

    let isMounted = true;
    getExploreTeacherDetail(id)
      .then((detail) => {
        if (!isMounted) return;
        setTeacher(detail.teacher);
        setRemoteAvailability([]);
        setPackagePlans((detail.packagePlans || []).filter((plan) => plan.is_active));
        setLessonDurationMinutes(detail.lessonDurationMinutes > 0 ? detail.lessonDurationMinutes : 60);
      })
      .catch(() => {})
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingRemote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
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
  }, [queryChildId]);

  useEffect(() => {
    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setParentPackages([]);
      setIsLoadingPackages(false);
      return;
    }

    let isMounted = true;
    setIsLoadingPackages(true);

    listParentPackages(accessToken)
      .then((response) => {
        if (!isMounted) return;
        setParentPackages(response.packages || []);
      })
      .catch(() => {
        if (!isMounted) return;
        setParentPackages([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingPackages(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!teacher || !isUuidLike(teacher.id)) {
      setRemoteAvailability(null);
      setIsLoadingAvailability(false);
      return;
    }

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setRemoteAvailability(null);
      setIsLoadingAvailability(false);
      return;
    }

    let isMounted = true;
    const from = new Date();
    const to = new Date();
    to.setDate(from.getDate() + 14);
    const fromIso = from.toISOString().slice(0, 10);
    const toIso = to.toISOString().slice(0, 10);

    setIsLoadingAvailability(true);
    getTeacherAvailabilitySlots(accessToken, {
      teacherProfileId: teacher.id,
      from: fromIso,
      to: toIso,
      durationMinutes: lessonDurationMinutes,
    })
      .then((response) => {
        if (!isMounted) return;
        setRemoteAvailability(
          response.slots.map((slot) => ({
            dateIso: slot.date_iso,
            dateLabel: slot.date_label,
            slots: slot.times,
          })),
        );
      })
      .catch(() => {
        if (!isMounted) return;
        setRemoteAvailability(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingAvailability(false);
      });

    return () => {
      isMounted = false;
    };
  }, [lessonDurationMinutes, teacher]);

  useEffect(() => {
    if (!availability.length) {
      setSelectedDate("");
      return;
    }

    if (!selectedDate || !availability.some((day) => day.dateIso === selectedDate)) {
      setSelectedDate(initialDate);
    }
  }, [availability, initialDate, selectedDate]);

  useEffect(() => {
    if (timeOptions.length === 0) {
      setSelectedTime("");
      return;
    }
    if (!selectedTime || !timeOptions.includes(selectedTime)) {
      setSelectedTime(initialTime);
    }
  }, [initialTime, selectedTime, timeOptions]);

  useEffect(() => {
    if (!modalities.includes(selectedModality)) {
      setSelectedModality(modalities[0] ?? "online");
    }
  }, [modalities, selectedModality]);

  useEffect(() => {
    if (queryPackagePlanId && packagePlans.some((plan) => plan.id === queryPackagePlanId)) {
      setSelectedOffer(`plan:${queryPackagePlanId}`);
      return;
    }
    if (queryPackageId && activePackages.some((bookingPackage) => bookingPackage.id === queryPackageId)) {
      setSelectedOffer(`package:${queryPackageId}`);
    }
  }, [activePackages, packagePlans, queryPackageId, queryPackagePlanId]);

  useEffect(() => {
    if (selectedOffer.startsWith("plan:") && !selectedPackagePlan) {
      setSelectedOffer("single");
      return;
    }
    if (selectedOffer.startsWith("package:") && !selectedActivePackage) {
      setSelectedOffer("single");
    }
  }, [selectedActivePackage, selectedOffer, selectedPackagePlan]);

  const selectedDayLabel = availability.find((day) => day.dateIso === selectedDate)?.dateLabel ?? "-";
  const estimatedBasePriceCents = teacher?.pricePerClassCents ?? Math.round((teacher?.pricePerClass ?? 0) * 100);
  const selectedPackagePlanAmountCents =
    selectedPackagePlan?.estimated_final_amount_cents
    ?? selectedPackagePlan?.estimated_original_amount_cents
    ?? 0;
  const estimatedTotalCents = selectedActivePackage
    ? 0
    : calculateParentCheckoutTotalCents(selectedPackagePlan ? selectedPackagePlanAmountCents : estimatedBasePriceCents);
  const selectedChildName =
    children.find((child) => child.id === selectedChildId)?.name || "Não selecionado";
  const requiresChildSelection = true;
  const isPackagePurchase = Boolean(selectedPackagePlan);
  const isPackageSession = Boolean(selectedActivePackage);

  const handleDateSelection = (dateIso: string) => {
    setSelectedDate(dateIso);
    const nextDaySlots = availability.find((day) => day.dateIso === dateIso)?.slots ?? [];
    setSelectedTime(nextDaySlots[0] ?? "");
  };

  const canContinue = Boolean(
    teacher
      && (!requiresChildSelection || selectedChildId)
      && selectedDate
      && selectedTime,
  );

  const handleContinue = () => {
    if (!teacher || !canContinue) return;

    if (selectedPackagePlan) {
      const packageCheckoutParams = new URLSearchParams({
        packagePlanId: selectedPackagePlan.id,
        date: selectedDate,
        time: selectedTime,
        modality: selectedModality,
      });
      if (selectedChildId) packageCheckoutParams.set("childId", selectedChildId);
      navigate(`/checkout/${teacher.id}?${packageCheckoutParams.toString()}`);
      return;
    }

    const checkoutParams = new URLSearchParams({
      date: selectedDate,
      time: selectedTime,
      modality: selectedModality,
    });
    if (selectedChildId) checkoutParams.set("childId", selectedChildId);
    if (selectedActivePackage) checkoutParams.set("packageId", selectedActivePackage.id);

    navigate(`/checkout/${teacher.id}?${checkoutParams.toString()}`);
  };

  if (!teacher) {
    return (
      <AppShell hideNav>
        <TopBar title="Agendar aula" showBack />
        <div className="px-4 pt-10">
          <div className="card-kidario p-6 text-center">
            <p className="text-foreground font-medium">
              {isLoadingRemote ? "Carregando professora..." : "Professora não encontrada."}
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
      <TopBar title="Agendar aula" showBack />

      <div className="px-4 pt-6 pb-8 space-y-6">
        <TeacherBookingHeaderCard
          teacherName={teacher.name}
          teacherAvatar={teacher.avatar}
          specialty={teacher.specialties[0]}
          pricePerHour={teacher.pricePerClass}
        />

        <section className="card-kidario p-4 space-y-3">
          <h3 className="font-display text-lg font-semibold text-foreground">Para qual filho é esta aula?</h3>
          {isLoadingChildren ? (
            <p className="text-sm text-muted-foreground">Carregando crianças...</p>
          ) : children.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {getSupabaseAccessToken()
                ? "Nenhuma criança cadastrada. Complete o cadastro no perfil de responsável."
                : "Entre como responsável para selecionar o aluno da aula."}
            </p>
          ) : (
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o aluno" />
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

        <section className="card-kidario p-4 space-y-3">
          <h3 className="font-display text-lg font-semibold text-foreground">Tipo de reserva</h3>
          <OfferButton
            selected={selectedOffer === "single"}
            icon={<Calendar className="w-5 h-5" />}
            title="Aula avulsa"
            description={`${lessonDurationMinutes} minutos · pagamento por aula`}
            value={formatCurrencyCents(calculateParentCheckoutTotalCents(estimatedBasePriceCents))}
            onClick={() => setSelectedOffer("single")}
          />

          {isLoadingPackages && (
            <p className="text-sm text-muted-foreground">Carregando pacotes comprados...</p>
          )}

          {activePackages.map((bookingPackage) => (
            <OfferButton
              key={bookingPackage.id}
              selected={selectedOffer === `package:${bookingPackage.id}`}
              icon={<PackageCheck className="w-5 h-5" />}
              title="Usar pacote ativo"
              description={`${bookingPackage.remaining_sessions} de ${bookingPackage.total_sessions} aulas restantes`}
              value="R$ 0,00"
              onClick={() => setSelectedOffer(`package:${bookingPackage.id}`)}
            />
          ))}

          {packagePlans.map((plan) => (
            <OfferButton
              key={plan.id}
              selected={selectedOffer === `plan:${plan.id}`}
              icon={<ShoppingBag className="w-5 h-5" />}
              title={plan.name}
              description={`${plan.sessions_count} aulas · ${formatDiscount(plan.discount_percent)} de desconto`}
              value={
                plan.estimated_final_amount_cents != null
                  ? formatCurrencyCents(calculateParentCheckoutTotalCents(plan.estimated_final_amount_cents))
                  : "Pacote"
              }
              onClick={() => setSelectedOffer(`plan:${plan.id}`)}
            />
          ))}
        </section>

        <section className="card-kidario p-4 space-y-3">
          <h3 className="font-display text-lg font-semibold text-foreground">Modalidade</h3>
          <div className="flex gap-2">
            {modalities.map((modality) => (
              <button key={modality} type="button" onClick={() => setSelectedModality(modality)}>
                <Chip variant={selectedModality === modality ? "mint" : "default"} size="md">
                  {modality === "online" ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                  {modality === "online" ? "Online" : "Presencial"}
                </Chip>
              </button>
            ))}
          </div>
        </section>

        <section className="card-kidario p-4 space-y-3">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {isPackagePurchase ? "Duração da primeira aula" : "Duração da aula"}
          </h3>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{lessonDurationMinutes} minutos</span>
          </p>
        </section>

        <section className="card-kidario p-4 space-y-3">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {isPackagePurchase ? "Selecione o dia da primeira aula" : "Selecione o dia"}
          </h3>
          {isLoadingAvailability ? (
            <p className="text-sm text-muted-foreground">Carregando horários disponíveis...</p>
          ) : !availability.length && (
            <p className="text-sm text-muted-foreground">Sem horários disponíveis para esta professora.</p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide [&::-webkit-scrollbar]:hidden">
            {availability.map((day) => (
              <button
                key={day.dateIso}
                type="button"
                onClick={() => handleDateSelection(day.dateIso)}
                className="shrink-0"
              >
                <Chip variant={selectedDate === day.dateIso ? "mint" : "default"} size="md">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  {day.dateLabel}
                </Chip>
              </button>
            ))}
          </div>

          <div className="pt-1">
            <p className="text-sm text-muted-foreground mb-2">Horários disponíveis</p>
            <div className="flex flex-wrap gap-2">
              {timeOptions.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedTime(time)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedTime === time
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>
        </section>

        <BookingSummaryCard
          title={isPackagePurchase ? "Resumo do pacote" : "Resumo da reserva"}
          rows={
            isPackagePurchase && selectedPackagePlan
              ? [
                  { label: "Filho(a):", value: selectedChildName },
                  { label: "Pacote:", value: selectedPackagePlan.name },
                  { label: "Aulas:", value: `${selectedPackagePlan.sessions_count}` },
                  { label: "Desconto:", value: formatDiscount(selectedPackagePlan.discount_percent) },
                  { label: "Primeira aula:", value: selectedDayLabel },
                  { label: "Horário:", value: selectedTime || "-" },
                  { label: "Modalidade:", value: selectedModality === "online" ? "Online" : "Presencial" },
                ]
              : [
                  { label: "Filho(a):", value: selectedChildName },
                  ...(isPackageSession
                    ? [{ label: "Pacote:", value: "1 aula do pacote ativo" }]
                    : []),
                  { label: "Data:", value: selectedDayLabel },
                  { label: "Horário:", value: selectedTime || "-" },
                  { label: "Modalidade:", value: selectedModality === "online" ? "Online" : "Presencial" },
                  { label: "Duração:", value: `${lessonDurationMinutes} minutos` },
                ]
          }
          totalLabel={isPackageSession ? "A pagar agora" : "Estimativa"}
          totalValue={formatCurrencyCents(estimatedTotalCents)}
        />

        <KidarioButton variant="hero" size="xl" fullWidth onClick={handleContinue} disabled={!canContinue}>
          {isPackagePurchase
            ? "Continuar para compra"
            : isPackageSession
              ? "Continuar com pacote"
              : "Continuar para pagamento"}
        </KidarioButton>
      </div>
    </AppShell>
  );
}

function OfferButton({
  selected,
  icon,
  title,
  description,
  value,
  onClick,
}: {
  selected: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-primary"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-primary">{value}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function formatDiscount(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
