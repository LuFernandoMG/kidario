import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { TEACHER_PROFILE_SETTINGS_PATH } from "@/routes/frontend";

export default function TeacherProfileSettingsScreen() {
  return <FrontendShellScreen path={TEACHER_PROFILE_SETTINGS_PATH} />;
}
