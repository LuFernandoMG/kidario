import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { PROFILE_PATH } from "@/routes/frontend";

export default function ProfileScreen() {
  return <FrontendShellScreen path={PROFILE_PATH} />;
}
