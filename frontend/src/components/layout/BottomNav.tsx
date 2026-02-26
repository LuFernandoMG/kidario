import { Link, useLocation } from "react-router-dom";
import { Search, Calendar, TrendingUp, User, LayoutDashboard, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getAuthSession } from "@/lib/authSession";
import {
  TEACHER_AGENDA_PATH,
  TEACHER_CONTROL_CENTER_PATH,
  TEACHER_FINANCE_PATH,
  TEACHER_STUDENTS_PATH,
} from "@/domains/teacher/lib/teacherRoutes";
import { TEACHER_PRIVATE_SIGNUP_PATH } from "@/lib/privateRoutes";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const parentNavItems: NavItem[] = [
  { path: "/explorar", label: "Explorar", icon: <Search className="w-5 h-5" /> },
  { path: "/agenda", label: "Agenda", icon: <Calendar className="w-5 h-5" /> },
  { path: "/progresso", label: "Progresso", icon: <TrendingUp className="w-5 h-5" /> },
  { path: "/perfil", label: "Perfil", icon: <User className="w-5 h-5" /> },
];

const teacherNavItems: NavItem[] = [
  { path: TEACHER_CONTROL_CENTER_PATH, label: "Início", icon: <LayoutDashboard className="w-5 h-5" /> },
  { path: TEACHER_AGENDA_PATH, label: "Agenda", icon: <Calendar className="w-5 h-5" /> },
  { path: TEACHER_STUDENTS_PATH, label: "Alunos", icon: <TrendingUp className="w-5 h-5" /> },
  { path: TEACHER_FINANCE_PATH, label: "Financeiro", icon: <Wallet className="w-5 h-5" /> },
  { path: "/perfil", label: "Perfil", icon: <User className="w-5 h-5" /> },
];

export function BottomNav() {
  const location = useLocation();
  const authSession = getAuthSession();
  const navItems = authSession.role === "teacher" ? teacherNavItems : parentNavItems;

  // Don't show on auth pages
  const hideOnPaths = ["/", "/login", "/cadastro", TEACHER_PRIVATE_SIGNUP_PATH];
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
                  initial={{ x: 0 }}
                  animate={{ x: -18 }}
                  layoutId="bottomNavIndicator"
                  className="absolute -top-0.5 left-1/2 w-8 h-1 bg-primary rounded-full"
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
