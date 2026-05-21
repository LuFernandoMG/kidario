import { cn } from "@/lib/utils";

interface ChipProps {
  children: React.ReactNode;
  variant?: "mint" | "lavender" | "coral" | "default";
  size?: "sm" | "md";
  className?: string;
}

export function Chip({ 
  children, 
  variant = "default", 
  size = "md",
  className 
}: ChipProps) {
  const variantClasses = {
    default: "bg-muted text-muted-foreground",
    mint: "bg-kidario-mint-light text-primary",
    lavender: "bg-kidario-lavender-light text-secondary-foreground",
    coral: "bg-kidario-coral-light text-accent-foreground",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium whitespace-nowrap",
      variantClasses[variant],
      sizeClasses[size],
      className
    )}>
      {children}
    </span>
  );
}

interface SpecialtiesChipsRowProps {
  specialties: string[];
  maxVisible?: number;
  className?: string;
}

export function SpecialtiesChipsRow({ 
  specialties, 
  maxVisible = 3,
  className 
}: SpecialtiesChipsRowProps) {
  const visible = specialties.slice(0, maxVisible);
  const remaining = specialties.length - maxVisible;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visible.map((specialty, index) => (
        <Chip 
          key={index} 
          variant={index === 0 ? "mint" : index === 1 ? "lavender" : "default"}
          size="sm"
        >
          {specialty}
        </Chip>
      ))}
      {remaining > 0 && (
        <Chip variant="default" size="sm">
          +{remaining}
        </Chip>
      )}
    </div>
  );
}
