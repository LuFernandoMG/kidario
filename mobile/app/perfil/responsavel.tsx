import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { PARENT_PROFILE_SETTINGS_PATH } from "@/routes/frontend";

export default function ParentProfileSettingsScreen() {
  return <FrontendShellScreen path={PARENT_PROFILE_SETTINGS_PATH} />;
}
