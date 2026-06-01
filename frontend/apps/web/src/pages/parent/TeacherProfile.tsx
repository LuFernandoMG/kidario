import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Video, MapPin, Calendar, MessageCircle, PackageCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { type Teacher } from "@/components/explore/TeacherCard";
import { RatingStars } from "@/components/explore/RatingStars";
import { VerifiedBadge } from "@/components/explore/VerifiedBadge";
import { Chip } from "@/components/ui/Chip";
import { type DayAvailability } from "@/lib/bookingUtils";
import {
  getExploreTeacherDetail,
  type ExplorePackagePlan,
  type ExplorePublicReviewPreview,
} from "@/data/api/explore";
import { DEFAULT_TEACHER_AVATAR } from "@/lib/avatarUrl";
import { useToast } from "@/hooks/use-toast";
import { formatCurrencyCents } from "@/lib/pricing";

function formatExperiencePeriod(periodFrom: string, periodTo?: string | null, currentPosition?: boolean) {
  if (currentPosition) {
    return `${periodFrom} - Atual`;
  }

  if (periodTo) {
    return `${periodFrom} - ${periodTo}`;
  }

  return periodFrom;
}

const degreeTypeLabels: Record<string, string> = {
  graduacao: "Graduação",
  "pos-graduacao": "Pós-graduação",
  especializacao: "Especialização",
  mestrado: "Mestrado",
  doutorado: "Doutorado",
  "curso-livre": "Curso livre / certificação",
};

function formatDegreeType(degreeType: string) {
  return degreeTypeLabels[degreeType] || degreeType;
}

export default function TeacherProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [remoteAvailability, setRemoteAvailability] = useState<DayAvailability[] | null>(null);
  const [packagePlans, setPackagePlans] = useState<ExplorePackagePlan[]>([]);
  const [latestReviews, setLatestReviews] = useState<ExplorePublicReviewPreview[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  useEffect(() => {
    if (!id) {
      setTeacher(null);
      setRemoteAvailability(null);
      return;
    }

    setTeacher(null);
    setRemoteAvailability(null);
    setPackagePlans([]);
    setLatestReviews([]);
    setIsLoadingRemote(true);

    let isMounted = true;
    getExploreTeacherDetail(id)
      .then((remoteTeacher) => {
        if (!isMounted) return;
        setTeacher(remoteTeacher.teacher);
        setRemoteAvailability(remoteTeacher.nextSlots);
        setPackagePlans(remoteTeacher.packagePlans);
        setLatestReviews(remoteTeacher.latestReviews);
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
    if (remoteAvailability !== null) {
      return remoteAvailability;
    }
    return [];
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
          initial={{ scale: 0.8, opacity: 0, x: -100 }}
          animate={{ scale: 1, opacity: 1, x: -50 }}
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
          transition={{ delay: 0.16 }}
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
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <h2 className="section-title">Sobre</h2>
          <p className="text-foreground leading-relaxed">
            {teacher.bio}
          </p>
        </motion.section>

        {/* Professional Experience */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.23 }}
          className="mt-6"
        >
          <h2 className="section-title">Experiência profissional</h2>
          {teacher.experienceEntries && teacher.experienceEntries.length > 0 ? (
            <div className="space-y-3">
              {teacher.experienceEntries.map((experience, index) => (
                <div key={experience.id || `${experience.institution}-${index}`} className="card-kidario p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-foreground">{experience.role}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{experience.institution}</p>
                    </div>
                    <span className="text-xs text-muted-foreground text-right">
                      {formatExperiencePeriod(
                        experience.periodFrom,
                        experience.periodTo,
                        experience.currentPosition,
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 mt-3 leading-relaxed">
                    {experience.responsibilities}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-kidario p-4">
              <p className="text-foreground">{teacher.experience}</p>
              {teacher.requestExperienceAnonymity ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Os detalhes institucionais foram ocultados a pedido da professora, mas a experiência foi validada pela plataforma.
                </p>
              ) : null}
            </div>
          )}
        </motion.section>

        {/* Academic History */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="mt-6"
        >
          <h2 className="section-title">História acadêmica</h2>
          {teacher.formationEntries && teacher.formationEntries.length > 0 ? (
            <div className="space-y-3">
              {teacher.formationEntries.map((formation, index) => (
                <div key={formation.id || `${formation.institution}-${index}`} className="card-kidario p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-foreground">{formation.courseName}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{formation.institution}</p>
                    </div>
                    {formation.completionYear ? (
                      <span className="text-xs text-muted-foreground text-right">
                        {formation.completionYear}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-foreground/90 mt-3 leading-relaxed">
                    {formatDegreeType(formation.degreeType)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-kidario p-4">
              <p className="text-foreground">Formação acadêmica não informada.</p>
            </div>
          )}
        </motion.section>

        {/* Specialties */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
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
        {packagePlans.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6"
          >
            <h2 className="section-title">Pacotes de aulas</h2>
            <div className="space-y-3">
              {packagePlans.map((plan) => (
                <div key={plan.id} className="card-kidario p-4">
                  <div className="flex items-start gap-3">
                    <PackageCheck className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-foreground">{plan.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {plan.sessions_count} aulas · {plan.discount_percent}% de desconto
                          </p>
                        </div>
                        {plan.estimated_final_amount_cents != null && (
                          <span className="font-display font-semibold text-primary">
                            {formatCurrencyCents(plan.estimated_final_amount_cents)}
                          </span>
                        )}
                      </div>
                      {plan.description && (
                        <p className="text-sm text-foreground/90 mt-3 leading-relaxed">{plan.description}</p>
                      )}
                      <button
                        type="button"
                        className="text-primary text-sm font-medium hover:underline mt-3"
                        onClick={() => navigate(`/agendar/${teacher.id}?packagePlanId=${plan.id}`)}
                      >
                        Comprar pacote
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Availability Preview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <h2 className="section-title">Próximos horários</h2>
          {availableSlots.length > 0 ? (
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
          ) : (
            <div className="card-kidario p-4">
              <p className="text-sm text-muted-foreground">
                Sem horários disponíveis nos próximos dias.
              </p>
            </div>
          )}
        </motion.section>

        {/* Reviews Preview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6"
        >
          <h2 className="section-title">Avaliações</h2>
          {latestReviews.length > 0 ? (
            <div className="space-y-3">
              {latestReviews.map((review) => (
                <div key={review.id} className="card-kidario p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-kidario-lavender-light flex items-center justify-center text-secondary-foreground font-medium">
                      A
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">Avaliação verificada</span>
                        <RatingStars rating={review.rating} size="sm" showValue={false} />
                      </div>
                      {review.comment && (
                        <p className="text-muted-foreground text-sm mt-1">{review.comment}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(review.submitted_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card-kidario p-4">
              <p className="text-sm text-muted-foreground">
                Esta professora ainda não possui avaliações publicadas.
              </p>
            </div>
          )}
        </motion.section>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <div className="flex gap-3 max-w-lg mx-auto">
          <KidarioButton
            variant="outline"
            size="lg"
            className="shrink-0"
            onClick={() =>
              toast({
                title: "Chat disponível após agendamento",
                description: "Agende uma aula para liberar o chat com esta professora.",
              })
            }
          >
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
