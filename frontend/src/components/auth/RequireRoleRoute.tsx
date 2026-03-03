import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { getAuthSession, type UserRole } from "@/lib/authSession";
import { TEACHER_CONTROL_CENTER_PATH } from "@/domains/teacher/lib/teacherRoutes";
import { ADMIN_HIDDEN_DASHBOARD_PATH } from "@/lib/privateRoutes";

interface RequireRoleRouteProps {
  allowedRoles: UserRole[];
  children: ReactNode;
}

export function RequireRoleRoute({ allowedRoles, children }: RequireRoleRouteProps) {
  const location = useLocation();
  const session = getAuthSession();

  if (!session.isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (!session.role || !allowedRoles.includes(session.role)) {
    const fallback = session.role === "admin"
      ? ADMIN_HIDDEN_DASHBOARD_PATH
      : session.role === "teacher"
        ? TEACHER_CONTROL_CENTER_PATH
        : "/explorar";
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
