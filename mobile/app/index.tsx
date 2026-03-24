import { NativeEntryHub } from "@/components/native/NativeEntryHub";
import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { isNativeEntryFlowEnabled } from "@/lib/env";
import { frontendRoutes } from "@/routes/frontend";

export default function HomeScreen() {
  if (isNativeEntryFlowEnabled()) {
    return <NativeEntryHub />;
  }

  return <FrontendShellScreen path={frontendRoutes.shared.root} />;
}
