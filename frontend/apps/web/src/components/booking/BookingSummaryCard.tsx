import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BookingSummaryRow {
  label: string;
  value: ReactNode;
}

interface BookingSummaryCardProps {
  title: string;
  rows: BookingSummaryRow[];
  totalLabel?: string;
  totalValue?: ReactNode;
  className?: string;
}

export function BookingSummaryCard({
  title,
  rows,
  totalLabel,
  totalValue,
  className,
}: BookingSummaryCardProps) {
  return (
    <section className={cn("card-kidario p-4", className)}>
      <h3 className="font-display text-lg font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <p key={row.label} className="text-foreground">
            <span className="text-muted-foreground">{row.label}</span> {row.value}
          </p>
        ))}

        {totalLabel && totalValue !== undefined && (
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <span className="font-display text-lg font-semibold text-foreground">{totalLabel}</span>
            <span className="font-display text-lg font-semibold text-primary">{totalValue}</span>
          </div>
        )}
      </div>
    </section>
  );
}
