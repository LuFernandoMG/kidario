import { Link } from "react-router-dom";
import { Clock, Video, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { RatingStars } from "./RatingStars";
import { VerifiedBadge } from "./VerifiedBadge";
import { SpecialtiesChipsRow } from "@/components/ui/Chip";
import { cn } from "@/lib/utils";
import { DEFAULT_TEACHER_AVATAR } from "@/lib/avatarUrl";

export interface Teacher {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  pricePerClass: number;
  specialties: string[];
  isVerified: boolean;
  isOnline: boolean;
  isPresential: boolean;
  nextAvailability?: string;
  experience: string;
  bio?: string;
}

interface TeacherCardProps {
  teacher: Teacher;
  className?: string;
  index?: number;
}

export function TeacherCard({ teacher, className, index = 0 }: TeacherCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        to={`/professora/${teacher.id}`}
        className={cn(
          "card-kidario block p-4 hover:shadow-kidario-lg transition-all duration-200 active:scale-[0.99]",
          className
        )}
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <img
              src={teacher.avatar}
              alt={teacher.name}
              className="w-16 h-16 rounded-2xl object-cover bg-muted"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = DEFAULT_TEACHER_AVATAR;
              }}
            />
            {teacher.isOnline && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-success rounded-full border-2 border-card flex items-center justify-center">
                <Video className="w-3 h-3 text-success-foreground" />
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-display font-semibold text-foreground truncate">
                    {teacher.name}
                  </h3>
                  {teacher.isVerified && <VerifiedBadge showText={false} />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {teacher.experience}
                </p>
              </div>
              
              {/* Price */}
              <div className="text-right shrink-0">
                <span className="font-display font-semibold text-primary">
                  R$ {teacher.pricePerClass}
                </span>
                <span className="text-xs text-muted-foreground block">/aula</span>
              </div>
            </div>

            {/* Rating */}
            <div className="mt-2">
              <RatingStars 
                rating={teacher.rating} 
                reviewCount={teacher.reviewCount}
                size="sm"
              />
            </div>

            {/* Specialties */}
            <div className="mt-2">
              <SpecialtiesChipsRow specialties={teacher.specialties} maxVisible={3} />
            </div>

            {/* Availability & Modality */}
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              {teacher.nextAvailability && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {teacher.nextAvailability}
                </span>
              )}
              {teacher.isPresential && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
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
