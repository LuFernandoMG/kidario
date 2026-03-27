import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { PROGRESS_PATH } from "@/routes/frontend";

export default function ProgressScreen() {
  return <FrontendShellScreen path={PROGRESS_PATH} />;
}
