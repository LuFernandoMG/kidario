import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { LOGIN_PATH } from "@/routes/frontend";

export default function LoginScreen() {
  return <FrontendShellScreen path={LOGIN_PATH} />;
}
