import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { ROOT_PATH } from "@/routes/frontend";

export default function HomeScreen() {
  return <FrontendShellScreen path={ROOT_PATH} />;
}
