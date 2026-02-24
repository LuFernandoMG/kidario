import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, Video, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BookingStatusPill } from "@/components/booking/BookingStatusPill";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import { getParentAgenda } from "@/lib/backendBookings";
import { DEFAULT_TEACHER_AVATAR, resolveTeacherAvatarUrl } from "@/lib/avatarUrl";
import { Skeleton } from "@/components/ui/skeleton";

type TabType = "proximas" | "passadas";

interface Booking {
  id: string;
  teacherName: string;
  teacherAvatar: string;
  date: string;
  dateIso?: string;
  time: string;
  status: "confirmada" | "pendente" | "cancelada" | "concluida";
  isOnline: boolean;
  specialty: string;
}

export default function Agenda() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("proximas");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const authSession = getAuthSession();
    const accessToken = getSupabaseAccessToken();
    if (!authSession.isAuthenticated || !accessToken) {
      navigate("/login?returnTo=%2Fagenda");
      return;
    }

    let isMounted = true;
    setIsLoadingRemote(true);
    setLoadError("");

    const backendTab = activeTab === "proximas" ? "upcoming" : "past";
    getParentAgenda(accessToken, { tab: backendTab })
      .then((response) => {
        if (!isMounted) return;

        const mapped = response.lessons.map((lesson) => ({
          id: lesson.id,
          teacherName: lesson.teacher_name,
          teacherAvatar:
            resolveTeacherAvatarUrl(lesson.teacher_avatar_url),
          date: lesson.date_label,
          dateIso: lesson.date_iso,
          time: lesson.time,
          status: lesson.status,
          isOnline: lesson.modality === "online",
          specialty: lesson.specialty || "Apoio pedagogico",
        }));
        setBookings(mapped);
      })
      .catch((error) => {
        if (!isMounted) return;
        setBookings([]);
        setLoadError(
          error instanceof Error ? error.message : "Não foi possível carregar sua agenda.",
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingRemote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, navigate]);

  return (
    <AppShell>
      <div className="px-4 pt-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-2xl font-bold text-foreground">
            Minha Agenda
          </h1>
          <p className="text-muted-foreground mt-1">
            Suas aulas agendadas
          </p>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 flex bg-muted rounded-xl p-1"
        >
          <button
            onClick={() => setActiveTab("proximas")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === "proximas"
                ? "bg-card text-foreground shadow-kidario-sm"
                : "text-muted-foreground"
            }`}
          >
            Próximas
          </button>
          <button
            onClick={() => setActiveTab("passadas")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === "passadas"
                ? "bg-card text-foreground shadow-kidario-sm"
                : "text-muted-foreground"
            }`}
          >
            Passadas
          </button>
        </motion.div>

        {/* Bookings List */}
        <div className="mt-6 space-y-3 pb-6">
          {isLoadingRemote ? (
            <AgendaSkeleton />
          ) : loadError ? (
            <div className="card-kidario p-4 text-sm text-destructive">{loadError}</div>
          ) : bookings.length > 0 ? (
            bookings.map((booking, index) => (
              <BookingCard key={booking.id} booking={booking} index={index} />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma aula {activeTab === "proximas" ? "agendada" : "passada"}
              </p>
              {activeTab === "proximas" && (
                <Link
                  to="/explorar"
                  className="inline-block mt-4 text-primary font-medium hover:underline"
                >
                  Explorar pedagogas
                </Link>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function BookingCard({ booking, index }: { booking: Booking; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to={`/aula/${booking.id}`}
        className="card-kidario block p-4 hover:shadow-kidario-lg transition-all active:scale-[0.99]"
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <img
            src={booking.teacherAvatar}
            alt={booking.teacherName}
            className="w-12 h-12 rounded-xl object-cover bg-muted shrink-0"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_TEACHER_AVATAR;
            }}
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-foreground truncate">
                  {booking.teacherName}
                </h3>
                <p className="text-sm text-muted-foreground">{booking.specialty}</p>
              </div>
              <BookingStatusPill status={booking.status} />
            </div>

            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {booking.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {booking.time}
              </span>
              {booking.isOnline ? (
                <span className="flex items-center gap-1 text-success">
                  <Video className="w-4 h-4" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  Presencial
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function AgendaSkeleton() {
  return (
    <>
      <span className="sr-only">Carregando agenda...</span>
      {[0, 1, 2].map((item) => (
        <div key={item} className="card-kidario p-4">
          <div className="flex gap-3">
            <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-14" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
