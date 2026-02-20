import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, Clock, Video, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BookingStatusPill } from "@/components/booking/BookingStatusPill";
import { getStoredBookings } from "@/lib/bookingsStorage";
import { getAuthSession, getSupabaseAccessToken } from "@/lib/authSession";
import { getParentAgenda } from "@/lib/backendBookings";

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

const mockBookings: Booking[] = [
  {
    id: "1",
    teacherName: "Ana Carolina Silva",
    teacherAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
    date: "Hoje",
    time: "14:00",
    status: "confirmada",
    isOnline: true,
    specialty: "Alfabetização",
  },
  {
    id: "2",
    teacherName: "Mariana Santos",
    teacherAvatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
    date: "Amanhã",
    time: "10:00",
    status: "pendente",
    isOnline: true,
    specialty: "Matemática",
  },
];

const pastBookings: Booking[] = [
  {
    id: "3",
    teacherName: "Juliana Oliveira",
    teacherAvatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=100&h=100&fit=crop&crop=face",
    date: "25 Jan",
    time: "16:00",
    status: "concluida",
    isOnline: false,
    specialty: "TDAH",
  },
  {
    id: "4",
    teacherName: "Ana Carolina Silva",
    teacherAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
    date: "20 Jan",
    time: "14:00",
    status: "concluida",
    isOnline: true,
    specialty: "Alfabetização",
  },
];

export default function Agenda() {
  const [activeTab, setActiveTab] = useState<TabType>("proximas");
  const [remoteBookings, setRemoteBookings] = useState<Booking[] | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  const storedBookings = useMemo(() => {
    return getStoredBookings().map((booking) => ({
      id: booking.id,
      teacherName: booking.teacherName,
      teacherAvatar: booking.teacherAvatar,
      date: booking.dateLabel,
      dateIso: booking.dateIso,
      time: booking.time,
      status: booking.status,
      isOnline: booking.modality === "online",
      specialty: booking.specialty,
    }));
  }, []);

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const upcomingStoredBookings = storedBookings.filter((booking) => {
    if (!booking.dateIso) return true;
    const parsedDate = new Date(`${booking.dateIso}T00:00:00`);
    return parsedDate >= today;
  });

  const pastStoredBookings = storedBookings.filter((booking) => {
    if (!booking.dateIso) return false;
    const parsedDate = new Date(`${booking.dateIso}T00:00:00`);
    return parsedDate < today;
  });

  const upcomingBookings = [...upcomingStoredBookings, ...mockBookings];
  const historyBookings = [...pastStoredBookings, ...pastBookings];

  useEffect(() => {
    const authSession = getAuthSession();
    const accessToken = getSupabaseAccessToken();
    if (!authSession.isAuthenticated || !accessToken) {
      setRemoteBookings(null);
      return;
    }

    let isMounted = true;
    setIsLoadingRemote(true);

    const backendTab = activeTab === "proximas" ? "upcoming" : "past";
    getParentAgenda(accessToken, { tab: backendTab })
      .then((response) => {
        if (!isMounted) return;

        const mapped = response.lessons.map((lesson) => ({
          id: lesson.id,
          teacherName: lesson.teacher_name,
          teacherAvatar:
            lesson.teacher_avatar_url ||
            "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
          date: lesson.date_label,
          dateIso: lesson.date_iso,
          time: lesson.time,
          status: lesson.status,
          isOnline: lesson.modality === "online",
          specialty: lesson.specialty || "Apoio pedagogico",
        }));
        setRemoteBookings(mapped);
      })
      .catch(() => {
        if (!isMounted) return;
        setRemoteBookings(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingRemote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const bookings =
    remoteBookings !== null ? remoteBookings : activeTab === "proximas" ? upcomingBookings : historyBookings;

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
          {isLoadingRemote && (
            <div className="card-kidario p-4 text-sm text-muted-foreground">Carregando agenda...</div>
          )}
          {bookings.length > 0 ? (
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
