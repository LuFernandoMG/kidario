import { cn } from "@/lib/utils";
import type { TeacherDecisionStatus } from "@/data/api/bookings";

interface StatusPillProps {
  status: "confirmada" | "pendente" | "cancelada" | "concluida";
  teacherDecisionStatus?: TeacherDecisionStatus;
  className?: string;
}

const statusConfig = {
  confirmada: {
    label: "Confirmada",
    className: "bg-success/10 text-success",
  },
  pendente: {
    label: "Pendente",
    className: "bg-warning/10 text-warning",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-destructive/10 text-destructive",
  },
  concluida: {
    label: "Concluída",
    className: "bg-muted text-muted-foreground",
  },
  recusada: {
    label: "Recusada",
    className: "bg-destructive/10 text-destructive",
  },
};

export function BookingStatusPill({ status, teacherDecisionStatus, className }: StatusPillProps) {
  const config = status === "pendente" && teacherDecisionStatus === "rejected"
    ? statusConfig.recusada
    : statusConfig[status];

  return (
    <span className={cn(
      "status-pill",
      config.className,
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
