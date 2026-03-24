import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function ResetPasswordScreen() {
  return <FrontendShellScreen path={frontendRoutes.shared.resetPassword} />;
}
