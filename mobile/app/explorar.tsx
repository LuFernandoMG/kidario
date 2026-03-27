import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { EXPLORE_PATH } from "@/routes/frontend";

export default function ExploreScreen() {
  return <FrontendShellScreen path={EXPLORE_PATH} />;
}
