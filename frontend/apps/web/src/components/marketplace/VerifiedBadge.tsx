import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  className?: string;
  showText?: boolean;
}

export function VerifiedBadge({ className, showText = true }: VerifiedBadgeProps) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1 text-primary",
      className
    )}>
      <BadgeCheck className="w-4 h-4 fill-primary text-primary-foreground" />
      {showText && (
        <span className="text-xs font-medium">Verificada</span>
      )}
    </div>
  );
}
