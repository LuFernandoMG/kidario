import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Pages
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Signup from "./domains/parent/pages/ParentSignupPage";
import RecoverPassword from "./pages/RecoverPassword";
import ResetPassword from "./pages/ResetPassword";
import Explore from "./pages/Explore";
import TeacherProfile from "./pages/TeacherProfile";
import BookingScheduler from "./pages/BookingScheduler";
import Checkout from "./pages/Checkout";
import BookingConfirmation from "./pages/BookingConfirmation";
import BookingDetail from "./pages/BookingDetail";
import Chat from "./pages/Chat";
import Agenda from "./pages/Agenda";
import Progress from "./pages/Progress";
import Profile from "./domains/profile/pages/ProfileRedirectPage";
import ParentProfileSettings from "./domains/parent/pages/ParentProfileSettingsPage";
import TeacherProfileSettings from "./domains/teacher/pages/TeacherProfileSettingsPage";
import NotFound from "./pages/NotFound";
import TeacherPrivateSignup from "./domains/teacher/pages/TeacherPrivateSignupPage";
import { TEACHER_PRIVATE_SIGNUP_PATH } from "./lib/privateRoutes";
import { RequireRoleRoute } from "@/components/auth/RequireRoleRoute";
import TeacherControlCenterPage from "@/domains/teacher/pages/TeacherControlCenterPage";
import TeacherAgendaPage from "@/domains/teacher/pages/TeacherAgendaPage";
import TeacherStudentsPage from "@/domains/teacher/pages/TeacherStudentsPage";
import TeacherPlanningPage from "@/domains/teacher/pages/TeacherPlanningPage";
import TeacherFinancePage from "@/domains/teacher/pages/TeacherFinancePage";
import { getAuthSession } from "@/lib/authSession";
import {
  TEACHER_AGENDA_PATH,
  TEACHER_CONTROL_CENTER_PATH,
  TEACHER_FINANCE_PATH,
  TEACHER_PLANNING_PATH,
  TEACHER_STUDENTS_PATH,
} from "@/domains/teacher/lib/teacherRoutes";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Auth Flow */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-senha" element={<RecoverPassword />} />
          <Route path="/redefinir-senha" element={<ResetPassword />} />
          <Route path="/cadastro" element={<Signup />} />
          <Route path="/escolher-perfil" element={<Navigate to="/cadastro" replace />} />
          <Route path="/escolher-professora" element={<Navigate to={TEACHER_PRIVATE_SIGNUP_PATH} replace />} />
          <Route path={TEACHER_PRIVATE_SIGNUP_PATH} element={<TeacherPrivateSignup />} />
          {/* Parent Flow */}
          <Route path="/explorar" element={<Explore />} />
          <Route path="/professora/centro" element={<Navigate to={TEACHER_CONTROL_CENTER_PATH} replace />} />
          <Route path="/professora/inicio" element={<Navigate to={TEACHER_CONTROL_CENTER_PATH} replace />} />
          <Route path="/professora/agenda" element={<Navigate to={TEACHER_AGENDA_PATH} replace />} />
          <Route path="/professora/alunos" element={<Navigate to={TEACHER_STUDENTS_PATH} replace />} />
          <Route path="/professora/planejamento" element={<Navigate to={TEACHER_PLANNING_PATH} replace />} />
          <Route path="/professora/financeiro" element={<Navigate to={TEACHER_FINANCE_PATH} replace />} />
          <Route path="/professora/:id" element={<TeacherProfile />} />
          <Route path="/agendar/:id" element={<BookingScheduler />} />
          <Route path="/checkout/:id" element={<Checkout />} />
          <Route path="/confirmacao-reserva/:bookingId" element={<BookingConfirmation />} />
          <Route
            path="/aula/:bookingId"
            element={(
              <RequireRoleRoute allowedRoles={["parent"]}>
                <BookingDetail />
              </RequireRoleRoute>
            )}
          />
          <Route path="/chat/:threadId" element={<Chat />} />
          <Route
            path="/agenda"
            element={(
              <RequireRoleRoute allowedRoles={["parent", "teacher"]}>
                <RoleAwareAgendaRoute />
              </RequireRoleRoute>
            )}
          />
          <Route
            path="/progresso"
            element={(
              <RequireRoleRoute allowedRoles={["parent"]}>
                <Progress />
              </RequireRoleRoute>
            )}
          />
          <Route path="/perfil" element={<Profile />} />
          <Route
            path="/perfil/responsavel"
            element={(
              <RequireRoleRoute allowedRoles={["parent"]}>
                <ParentProfileSettings />
              </RequireRoleRoute>
            )}
          />
          <Route
            path="/perfil/professora"
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
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
