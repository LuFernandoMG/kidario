import { Link, useLocation } from "react-router-dom";
import { Search, Calendar, TrendingUp, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { path: "/explorar", label: "Explorar", icon: <Search className="w-5 h-5" /> },
  { path: "/agenda", label: "Agenda", icon: <Calendar className="w-5 h-5" /> },
  { path: "/progresso", label: "Progresso", icon: <TrendingUp className="w-5 h-5" /> },
  { path: "/perfil", label: "Perfil", icon: <User className="w-5 h-5" /> },
];

export function BottomNav() {
  const location = useLocation();

  // Don't show on auth pages
  const hideOnPaths = ["/", "/login", "/cadastro"];
  if (hideOnPaths.includes(location.pathname)) return null;

  return (
    <nav className="bottom-nav z-50">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "bottom-nav-item flex-1 relative",
                isActive && "active"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className={cn(
                "transition-transform duration-200",
                isActive && "scale-110"
              )}>
                {item.icon}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
