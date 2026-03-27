import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_CONTROL_CENTER_LEGACY_PATHS } from "@/routes/frontend";

export default function TeacherControlCenterLegacyScreen() {
  return <FrontendShellScreen path={TEACHER_CONTROL_CENTER_LEGACY_PATHS[0]} />;
}
