import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

// Pages
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import RecoverPassword from "./pages/RecoverPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminHiddenDashboard from "./pages/AdminHiddenDashboard";
import NotificationsPage from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import Signup from "./pages/parent/Signup";
import Explore from "./pages/parent/Explore";
import TeacherProfile from "./pages/parent/TeacherProfile";
import BookingScheduler from "./pages/parent/BookingScheduler";
import Checkout from "./pages/parent/Checkout";
import BookingConfirmation from "./pages/parent/BookingConfirmation";
import BookingDetail from "./pages/parent/BookingDetail";
import Chat from "./pages/parent/Chat";
import Agenda from "./pages/parent/Agenda";
import Progress from "./pages/parent/Progress";
import Profile from "./pages/parent/Profile";
import ParentProfileSettings from "./pages/parent/ProfileSettings";
import TeacherControlCenterPage from "./pages/teacher/ControlCenter";
import TeacherAgendaPage from "./pages/teacher/Agenda";
import TeacherStudentsPage from "./pages/teacher/Students";
import TeacherPlanningPage from "./pages/teacher/Planning";
import TeacherFinancePage from "./pages/teacher/Finance";
import TeacherLessonClosurePage from "./pages/teacher/LessonClosure";
import TeacherPrivateSignup from "./pages/teacher/PrivateSignup";
import TeacherProfileSettings from "./pages/teacher/ProfileSettings";
import { RequireRoleRoute } from "@/components/auth/RequireRoleRoute";
import { TeacherPayoutProfileGate } from "@/components/teacher/TeacherPayoutProfileGate";
import { getAuthSession } from "@/lib/authSession";
import { ADMIN_HIDDEN_DASHBOARD_PATH } from "@/routes/admin";
import {
  TEACHER_AGENDA_LEGACY_PATH,
  TEACHER_CONTROL_CENTER_LEGACY_PATHS,
  TEACHER_FINANCE_LEGACY_PATH,
  TEACHER_PLANNING_LEGACY_PATH,
  TEACHER_PRIVATE_SIGNUP_LEGACY_PATH,
  TEACHER_STUDENTS_LEGACY_PATH,
} from "@/routes/legacy";
import {
  AGENDA_PATH,
  BOOKING_CONFIRMATION_PATH,
  BOOKING_DETAIL_PATH,
  BOOKING_SCHEDULER_PATH,
  CHAT_PATH,
  CHECKOUT_PATH,
  EXPLORE_PATH,
  LOGIN_PATH,
  NOTIFICATIONS_PATH,
  PARENT_PROFILE_SETTINGS_PATH,
  PROFILE_PATH,
  PROGRESS_PATH,
  RECOVER_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  ROOT_PATH,
  SIGNUP_PATH,
  TEACHER_PROFILE_PATH,
  TEACHER_PROFILE_SETTINGS_PATH,
} from "@/routes/paths";
import {
  TEACHER_AGENDA_PATH,
  TEACHER_CONTROL_CENTER_PATH,
  TEACHER_FINANCE_PATH,
  TEACHER_LESSON_CLOSURE_PATH,
  TEACHER_PLANNING_PATH,
  TEACHER_PRIVATE_SIGNUP_PATH,
  TEACHER_STUDENTS_PATH,
} from "@/routes/teacher";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RoleAwareAgendaRoute() {
  const authSession = getAuthSession();
  return authSession.role === "teacher" ? <TeacherAgendaPage /> : <Agenda />;
}

function AdminSessionGuard() {
  const location = useLocation();
  const authSession = getAuthSession();

  if (!authSession.isAuthenticated || authSession.role !== "admin") return null;
  if (location.pathname === ADMIN_HIDDEN_DASHBOARD_PATH) return null;
  return <Navigate to={ADMIN_HIDDEN_DASHBOARD_PATH} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <Analytics />
      <SpeedInsights />
      <BrowserRouter>
        <AdminSessionGuard />
        <TeacherPayoutProfileGate />
        <Routes>
          {/* Auth Flow */}
          <Route path={ROOT_PATH} element={<Welcome />} />
          <Route path={LOGIN_PATH} element={<Login />} />
          <Route path={RECOVER_PASSWORD_PATH} element={<RecoverPassword />} />
          <Route path={RESET_PASSWORD_PATH} element={<ResetPassword />} />
          <Route path={SIGNUP_PATH} element={<Signup />} />
          <Route path={ADMIN_HIDDEN_DASHBOARD_PATH} element={<AdminHiddenDashboard />} />
          <Route path={TEACHER_PRIVATE_SIGNUP_LEGACY_PATH} element={<Navigate to={TEACHER_PRIVATE_SIGNUP_PATH} replace />} />
          <Route path={TEACHER_PRIVATE_SIGNUP_PATH} element={<TeacherPrivateSignup />} />
          {/* Parent Flow */}
          <Route path={EXPLORE_PATH} element={<Explore />} />
          {TEACHER_CONTROL_CENTER_LEGACY_PATHS.map((path) => (
            <Route key={path} path={path} element={<Navigate to={TEACHER_CONTROL_CENTER_PATH} replace />} />
          ))}
          <Route path={TEACHER_AGENDA_LEGACY_PATH} element={<Navigate to={TEACHER_AGENDA_PATH} replace />} />
          <Route path={TEACHER_STUDENTS_LEGACY_PATH} element={<Navigate to={TEACHER_STUDENTS_PATH} replace />} />
          <Route path={TEACHER_PLANNING_LEGACY_PATH} element={<Navigate to={TEACHER_PLANNING_PATH} replace />} />
          <Route path={TEACHER_FINANCE_LEGACY_PATH} element={<Navigate to={TEACHER_FINANCE_PATH} replace />} />
          <Route path={TEACHER_PROFILE_PATH} element={<TeacherProfile />} />
          <Route path={BOOKING_SCHEDULER_PATH} element={<BookingScheduler />} />
          <Route path={CHECKOUT_PATH} element={<Checkout />} />
          <Route path={BOOKING_CONFIRMATION_PATH} element={<BookingConfirmation />} />
          <Route
            path={BOOKING_DETAIL_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["parent"]}>
                <BookingDetail />
              </RequireRoleRoute>
            )}
          />
          <Route path={CHAT_PATH} element={<Chat />} />
          <Route
            path={AGENDA_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["parent", "teacher"]}>
                <RoleAwareAgendaRoute />
              </RequireRoleRoute>
            )}
          />
          <Route
            path={PROGRESS_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["parent"]}>
                <Progress />
              </RequireRoleRoute>
            )}
          />
          <Route path={PROFILE_PATH} element={<Profile />} />
          <Route
            path={NOTIFICATIONS_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["parent", "teacher"]}>
                <NotificationsPage />
              </RequireRoleRoute>
            )}
          />
          <Route
            path={PARENT_PROFILE_SETTINGS_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["parent"]}>
                <ParentProfileSettings />
              </RequireRoleRoute>
            )}
          />
          <Route
            path={TEACHER_PROFILE_SETTINGS_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["teacher"]}>
                <TeacherProfileSettings />
              </RequireRoleRoute>
            )}
          />

          {/* Teacher Control Center */}
          <Route
            path={TEACHER_CONTROL_CENTER_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["teacher"]}>
                <TeacherControlCenterPage />
              </RequireRoleRoute>
            )}
          />
          <Route
            path={TEACHER_STUDENTS_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["teacher"]}>
                <TeacherStudentsPage />
              </RequireRoleRoute>
            )}
          />
          <Route
            path={TEACHER_PLANNING_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["teacher"]}>
                <TeacherPlanningPage />
              </RequireRoleRoute>
            )}
          />
          <Route
            path={TEACHER_FINANCE_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["teacher"]}>
                <TeacherFinancePage />
              </RequireRoleRoute>
            )}
          />
          <Route
            path={TEACHER_LESSON_CLOSURE_PATH}
            element={(
              <RequireRoleRoute allowedRoles={["teacher"]}>
                <TeacherLessonClosurePage />
              </RequireRoleRoute>
            )}
          />
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
