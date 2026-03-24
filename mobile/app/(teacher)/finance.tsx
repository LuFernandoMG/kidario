import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function TeacherFinanceScreen() {
  return <FrontendShellScreen path={frontendRoutes.teacher.finance} />;
}
