import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function TeacherStudentsScreen() {
  return <FrontendShellScreen path={frontendRoutes.teacher.students} />;
}
