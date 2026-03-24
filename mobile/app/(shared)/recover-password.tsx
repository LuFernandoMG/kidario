import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function RecoverPasswordScreen() {
  return <FrontendShellScreen path={frontendRoutes.shared.recoverPassword} />;
}
