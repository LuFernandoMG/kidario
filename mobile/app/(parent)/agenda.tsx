import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { frontendRoutes } from "@/routes/frontend";

export default function ParentAgendaScreen() {
  return <FrontendShellScreen path={frontendRoutes.parent.agenda} />;
}
