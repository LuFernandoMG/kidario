import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function ParentProfileScreen() {
  return <FrontendShellScreen path={frontendRoutes.parent.profile} />;
}
