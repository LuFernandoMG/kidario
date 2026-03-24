import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function TeacherHomeScreen() {
  return <FrontendShellScreen path={frontendRoutes.teacher.home} />;
}
