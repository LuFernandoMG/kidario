import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function LoginScreen() {
  return <FrontendShellScreen path={frontendRoutes.shared.login} />;
}
