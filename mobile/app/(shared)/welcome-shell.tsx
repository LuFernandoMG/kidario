import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function WelcomeShellScreen() {
  return <FrontendShellScreen path={frontendRoutes.shared.root} />;
}
