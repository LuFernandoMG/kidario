import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function TeacherPlanningScreen() {
  return <FrontendShellScreen path={frontendRoutes.teacher.planning} />;
}
