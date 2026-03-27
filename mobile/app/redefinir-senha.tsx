import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { RESET_PASSWORD_PATH } from "@/routes/frontend";

export default function ResetPasswordScreen() {
  return <FrontendShellScreen path={RESET_PASSWORD_PATH} />;
}
