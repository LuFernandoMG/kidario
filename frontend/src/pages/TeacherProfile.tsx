import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Video, MapPin, Calendar, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { type Teacher } from "@/components/marketplace/TeacherCard";
import { RatingStars } from "@/components/marketplace/RatingStars";
import { VerifiedBadge } from "@/components/marketplace/VerifiedBadge";
import { Chip } from "@/components/ui/Chip";
import { getTeacherById } from "@/data/mockTeachers";
import { buildTeacherAvailability, type DayAvailability } from "@/lib/bookingUtils";
import { getMarketplaceTeacherDetail } from "@/lib/backendMarketplace";
import { DEFAULT_TEACHER_AVATAR } from "@/lib/avatarUrl";

export default function TeacherProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<Teacher | null>(() => (id ? getTeacherById(id) ?? null : null));
  const [remoteAvailability, setRemoteAvailability] = useState<DayAvailability[] | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

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
      .then((remoteTeacher) => {
        if (!isMounted) return;
        setTeacher(remoteTeacher.teacher);
        setRemoteAvailability(remoteTeacher.nextSlots);
      })
      .catch(() => {
        if (!isMounted) return;
        setRemoteAvailability(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoadingRemote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const availableSlots = useMemo(() => {
    if (!teacher) return [];
    if (remoteAvailability && remoteAvailability.length > 0) {
      return remoteAvailability;
    }
    return buildTeacherAvailability(teacher.id, {
      days: 3,
      baseSlots: ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"],
      maxSlotsPerDay: 4,
    });
  }, [remoteAvailability, teacher]);

  if (!teacher) {
    return (
      <AppShell hideNav>
        <TopBar title="Perfil" showBack />
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">
            {isLoadingRemote ? "Carregando perfil da professora..." : "Professora não encontrada"}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <TopBar showBack transparent />
      
      {/* Hero Image */}
      <div className="relative -mt-14">
        <div className="h-48 bg-gradient-to-b from-kidario-mint-light to-background" />
        
        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -bottom-16 left-1/2 -translate-x-1/2"
        >
          <img
            src={teacher.avatar}
            alt={teacher.name}
            className="w-32 h-32 rounded-3xl object-cover border-4 border-card shadow-kidario-elevated"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_TEACHER_AVATAR;
            }}
          />
          {teacher.isOnline && (
            <span className="absolute bottom-2 right-2 w-8 h-8 bg-success rounded-full border-4 border-card flex items-center justify-center">
              <Video className="w-4 h-4 text-success-foreground" />
            </span>
          )}
        </motion.div>
      </div>

      {/* Content */}
      <div className="px-4 pt-20 pb-32">
        {/* Name & Badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="font-display text-2xl font-bold text-foreground">
            {teacher.name}
          </h1>
          <p className="text-muted-foreground mt-1">{teacher.experience}</p>
          
          <div className="flex items-center justify-center gap-3 mt-3">
            {teacher.isVerified && <VerifiedBadge />}
            {teacher.isOnline && (
              <Chip variant="mint" size="sm">
                <Video className="w-3 h-3 mr-1" />
                Online
              </Chip>
            )}
            {teacher.isPresential && (
              <Chip variant="lavender" size="sm">
                <MapPin className="w-3 h-3 mr-1" />
                Presencial
              </Chip>
            )}
          </div>
        </motion.div>

        {/* Rating & Price */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center gap-6 mt-6"
        >
          <div className="text-center">
            <RatingStars rating={teacher.rating} reviewCount={teacher.reviewCount} />
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <span className="font-display text-2xl font-bold text-primary">
              R$ {teacher.pricePerClass}
            </span>
            <span className="text-muted-foreground text-sm block">/aula</span>
          </div>
        </motion.div>

        {/* Bio */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8"
        >
          <h2 className="section-title">Sobre</h2>
          <p className="text-foreground leading-relaxed">
            {teacher.bio}
          </p>
        </motion.section>

        {/* Specialties */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6"
        >
          <h2 className="section-title">Especialidades</h2>
          <div className="flex flex-wrap gap-2">
            {teacher.specialties.map((specialty, index) => (
              <Chip 
                key={index} 
                variant={index === 0 ? "mint" : index === 1 ? "lavender" : "default"}
              >
                {specialty}
              </Chip>
            ))}
          </div>
        </motion.section>

        {/* Availability Preview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6"
        >
          <h2 className="section-title">Próximos horários</h2>
          <div className="space-y-3">
            {availableSlots.slice(0, 2).map((day, dayIndex) => (
              <div key={dayIndex} className="card-kidario p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">{day.dateLabel}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {day.slots.map((slot, slotIndex) => (
                    <button
                      key={slotIndex}
                      onClick={() => navigate(`/agendar/${teacher.id}?date=${day.dateIso}&time=${slot}`)}
                      className="px-3 py-2 bg-muted hover:bg-primary hover:text-primary-foreground rounded-lg text-sm font-medium transition-colors"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Reviews Preview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <h2 className="section-title">Avaliações</h2>
          <div className="card-kidario p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-kidario-lavender-light flex items-center justify-center text-secondary-foreground font-medium">
                M
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Maria L.</span>
                  <RatingStars rating={5} size="sm" showValue={false} />
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  "Excelente profissional! Meu filho evoluiu muito na leitura. Recomendo demais!"
                </p>
                <div className="flex gap-1 mt-2">
                  <Chip variant="mint" size="sm">Pontual</Chip>
                  <Chip variant="mint" size="sm">Carinhosa</Chip>
                </div>
              </div>
            </div>
          </div>
          <button className="w-full mt-3 text-primary text-sm font-medium hover:underline">
            Ver todas as {teacher.reviewCount} avaliações
          </button>
        </motion.section>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <div className="flex gap-3 max-w-lg mx-auto">
          <KidarioButton variant="outline" size="lg" className="shrink-0">
            <MessageCircle className="w-5 h-5" />
          </KidarioButton>
          <KidarioButton 
            variant="hero" 
            size="lg" 
            fullWidth
            onClick={() => navigate(`/agendar/${teacher.id}`)}
          >
            <Calendar className="w-5 h-5" />
            Agendar aula
          </KidarioButton>
        </div>
      </div>
    </AppShell>
  );
}
