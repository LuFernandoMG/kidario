import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PaymentMethodOptionProps {
  title: string;
  description: string;
  icon: ReactNode;
  selected: boolean;
  onSelect: () => void;
}

export function PaymentMethodOption({
  title,
  description,
  icon,
  selected,
  onSelect,
}: PaymentMethodOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-3 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        {title}
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </button>
  );
}
