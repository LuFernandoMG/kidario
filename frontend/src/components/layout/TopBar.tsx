import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { KidarioButton } from "@/components/ui/KidarioButton";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  rightAction?: ReactNode;
  className?: string;
  transparent?: boolean;
}

export function TopBar({ 
  title, 
  showBack = false, 
  rightAction, 
  className,
  transparent = false 
}: TopBarProps) {
  const navigate = useNavigate();

  return (
    <header className={cn(
      "sticky top-0 z-40 px-4 h-14 flex items-center justify-between",
      !transparent && "bg-background/80 backdrop-blur-lg border-b border-border/50",
      className
    )}>
      <div className="flex items-center gap-3 flex-1">
        {showBack && (
          <KidarioButton
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </KidarioButton>
        )}
        {title && (
          <h1 className="font-display font-semibold text-lg text-foreground truncate">
            {title}
          </h1>
        )}
      </div>
      {rightAction && (
        <div className="shrink-0">
          {rightAction}
        </div>
      )}
    </header>
  );
}
