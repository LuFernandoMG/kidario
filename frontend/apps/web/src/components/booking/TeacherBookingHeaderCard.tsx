import { DEFAULT_TEACHER_AVATAR } from "@/lib/avatarUrl";

interface TeacherBookingHeaderCardProps {
  teacherName: string;
  teacherAvatar: string;
  specialty?: string;
  pricePerHour: number;
}

export function TeacherBookingHeaderCard({
  teacherName,
  teacherAvatar,
  specialty,
  pricePerHour,
}: TeacherBookingHeaderCardProps) {
  return (
    <section className="card-kidario p-4">
      <div className="flex items-center gap-3">
        <img
          src={teacherAvatar}
          alt={teacherName}
          className="w-14 h-14 rounded-2xl object-cover bg-muted"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = DEFAULT_TEACHER_AVATAR;
          }}
        />
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-foreground truncate">{teacherName}</h2>
          {specialty && <p className="text-sm text-muted-foreground truncate">{specialty}</p>}
          <p className="text-sm font-medium text-primary mt-0.5">R$ {pricePerHour} / 60 min</p>
        </div>
      </div>
    </section>
  );
}
