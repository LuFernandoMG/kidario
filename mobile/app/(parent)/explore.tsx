import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function ParentExploreScreen() {
  return <FrontendShellScreen path={frontendRoutes.parent.explore} />;
}
