import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { SIGNUP_PATH } from "@/routes/frontend";

export default function SignupScreen() {
  return <FrontendShellScreen path={SIGNUP_PATH} />;
}
