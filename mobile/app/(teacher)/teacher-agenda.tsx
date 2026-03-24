import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function TeacherAgendaScreen() {
  return <FrontendShellScreen path={frontendRoutes.teacher.agenda} />;
}
