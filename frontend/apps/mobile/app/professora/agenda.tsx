import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_AGENDA_LEGACY_PATH } from "@/routes/frontend";

export default function TeacherAgendaLegacyScreen() {
  return <FrontendShellScreen path={TEACHER_AGENDA_LEGACY_PATH} />;
}
