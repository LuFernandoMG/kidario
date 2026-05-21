import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_PRIVATE_SIGNUP_PATH } from "@/routes/frontend";

export default function TeacherPrivateSignupScreen() {
  return <FrontendShellScreen path={TEACHER_PRIVATE_SIGNUP_PATH} />;
}
