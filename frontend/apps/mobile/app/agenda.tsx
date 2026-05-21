import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { AGENDA_PATH } from "@/routes/frontend";

export default function AgendaScreen() {
  return <FrontendShellScreen path={AGENDA_PATH} />;
}
