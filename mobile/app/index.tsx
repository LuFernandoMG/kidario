import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function HomeScreen() {
  return <FrontendShellScreen path={frontendRoutes.shared.root} />;
}
