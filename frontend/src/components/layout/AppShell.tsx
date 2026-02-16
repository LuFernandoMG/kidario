import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  className?: string;
  hideNav?: boolean;
}

export function AppShell({ children, className, hideNav = false }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <main className={cn(
        "min-h-screen",
        !hideNav && "pb-20",
        className
      )}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
