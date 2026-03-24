import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function TeacherPrivateSignupScreen() {
  return <FrontendShellScreen path={frontendRoutes.teacher.privateSignup} />;
}
