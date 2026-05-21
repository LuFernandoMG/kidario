import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: "confirmada" | "pendente" | "cancelada" | "concluida";
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
};

export function BookingStatusPill({ status, className }: StatusPillProps) {
  const config = statusConfig[status];

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
