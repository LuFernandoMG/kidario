import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { RECOVER_PASSWORD_PATH } from "@/routes/frontend";

export default function RecoverPasswordScreen() {
  return <FrontendShellScreen path={RECOVER_PASSWORD_PATH} />;
}
