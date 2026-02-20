import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Calendar, Clock, MapPin, Video } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { Chip } from "@/components/ui/Chip";
import { getTeacherById } from "@/data/mockTeachers";
import { BookingSummaryCard } from "@/components/booking/BookingSummaryCard";
import { TeacherBookingHeaderCard } from "@/components/booking/TeacherBookingHeaderCard";
import { BookingModality, DayAvailability, buildTeacherAvailability } from "@/lib/bookingUtils";
import { type Teacher } from "@/components/marketplace/TeacherCard";
import { getSupabaseAccessToken } from "@/lib/authSession";
import { getTeacherAvailabilitySlots } from "@/lib/backendBookings";
import { getMarketplaceTeacherDetail } from "@/lib/backendMarketplace";

const durationOptions = [45, 60, 90];

export default function BookingScheduler() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<Teacher | null>(() => (id ? getTeacherById(id) ?? null : null));
  const [remoteAvailability, setRemoteAvailability] = useState<DayAvailability[] | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  const modalities = useMemo<BookingModality[]>(() => {
    if (!teacher) return ["online"];
    const options: BookingModality[] = [];
    if (teacher.isOnline) options.push("online");
    if (teacher.isPresential) options.push("presencial");
    return options.length > 0 ? options : ["online"];
  }, [teacher]);

  const availability = useMemo<DayAvailability[]>(() => {
    if (!teacher) return [];
    if (remoteAvailability && remoteAvailability.length > 0) {
      return remoteAvailability;
    }
    return buildTeacherAvailability(teacher.id);
  }, [remoteAvailability, teacher]);

  const initialDate = useMemo(() => {
    const queryDate = searchParams.get("date");
    if (queryDate && availability.some((day) => day.dateIso === queryDate)) return queryDate;
    return availability[0]?.dateIso ?? "";
  }, [availability, searchParams]);

  const [selectedModality, setSelectedModality] = useState<BookingModality>(modalities[0] ?? "online");
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
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

  useEffect(() => {
    if (!id) {
      setTeacher(null);
      setRemoteAvailability(null);
      return;
    }

    const localTeacher = getTeacherById(id) ?? null;
    setTeacher(localTeacher);
    setRemoteAvailability(null);
    setIsLoadingRemote(true);

    let isMounted = true;
    getMarketplaceTeacherDetail(id)
      .then((detail) => {
        if (!isMounted) return;
        setTeacher(detail.teacher);
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
    if (!teacher || !isUuidLike(teacher.id)) {
      setRemoteAvailability(null);
      return;
    }

    const accessToken = getSupabaseAccessToken();
    if (!accessToken) {
      setRemoteAvailability(null);
      return;
    }

    let isMounted = true;
    const from = new Date();
    const to = new Date();
    to.setDate(from.getDate() + 14);
    const fromIso = from.toISOString().slice(0, 10);
    const toIso = to.toISOString().slice(0, 10);

    getTeacherAvailabilitySlots(accessToken, {
      teacherProfileId: teacher.id,
      from: fromIso,
      to: toIso,
      durationMinutes: selectedDuration,
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
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDuration, teacher]);

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

  const selectedDayLabel = availability.find((day) => day.dateIso === selectedDate)?.dateLabel ?? "-";
  const estimatedPrice = Math.round((teacher?.pricePerClass ?? 0) * (selectedDuration / 60));

  const handleDateSelection = (dateIso: string) => {
    setSelectedDate(dateIso);
    const nextDaySlots = availability.find((day) => day.dateIso === dateIso)?.slots ?? [];
    setSelectedTime(nextDaySlots[0] ?? "");
  };

  const canContinue = Boolean(teacher && selectedDate && selectedTime && selectedDuration > 0);

  const handleContinue = () => {
    if (!teacher || !canContinue) return;

    const checkoutParams = new URLSearchParams({
      date: selectedDate,
      time: selectedTime,
      duration: String(selectedDuration),
      modality: selectedModality,
    });

    navigate(`/checkout/${teacher.id}?${checkoutParams.toString()}`);
  };

  if (!teacher) {
    return (
      <AppShell hideNav>
        <TopBar title="Agendar aula" showBack />
        <div className="px-4 pt-10">
          <div className="card-kidario p-6 text-center">
            <p className="text-foreground font-medium">
              {isLoadingRemote ? "Carregando professora..." : "Professora nao encontrada."}
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
          <h3 className="font-display text-lg font-semibold text-foreground">Duracao da aula</h3>
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((duration) => (
              <button key={duration} type="button" onClick={() => setSelectedDuration(duration)}>
                <Chip variant={selectedDuration === duration ? "mint" : "default"} size="md">
                  <Clock className="w-3.5 h-3.5" />
                  {duration} min
                </Chip>
              </button>
            ))}
          </div>
        </section>

        <section className="card-kidario p-4 space-y-3">
          <h3 className="font-display text-lg font-semibold text-foreground">Selecione o dia</h3>
          {!availability.length && (
            <p className="text-sm text-muted-foreground">Sem horarios disponiveis para esta professora.</p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {availability.map((day) => (
              <button
                key={day.dateIso}
                type="button"
                onClick={() => handleDateSelection(day.dateIso)}
                className="shrink-0"
              >
                <Chip variant={selectedDate === day.dateIso ? "mint" : "default"} size="md">
                  <Calendar className="w-3.5 h-3.5" />
                  {day.dateLabel}
                </Chip>
              </button>
            ))}
          </div>

          <div className="pt-1">
            <p className="text-sm text-muted-foreground mb-2">Horarios disponiveis</p>
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
          title="Resumo da reserva"
          rows={[
            { label: "Data:", value: selectedDayLabel },
            { label: "Horario:", value: selectedTime || "-" },
            { label: "Modalidade:", value: selectedModality === "online" ? "Online" : "Presencial" },
            { label: "Duracao:", value: `${selectedDuration} minutos` },
          ]}
          totalLabel="Estimativa"
          totalValue={`R$ ${estimatedPrice}`}
        />

        <KidarioButton variant="hero" size="xl" fullWidth onClick={handleContinue} disabled={!canContinue}>
          Continuar para pagamento
        </KidarioButton>
      </div>
    </AppShell>
  );
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
