import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function ParentSignupScreen() {
  return <FrontendShellScreen path={frontendRoutes.parent.signup} />;
}
