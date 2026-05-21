import { useLocalSearchParams } from "expo-router";

import { FrontendShellStatus } from "@/components/webview/FrontendShellStatus";
import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { buildFrontendUrl } from "@/lib/frontendWeb";
import { ROOT_PATH, buildFrontendPathFromSegments, isBlockedMobilePath } from "@/routes/frontend";

export default function FrontendCatchAllScreen() {
  const { path } = useLocalSearchParams<{ path?: string | string[] }>();
  const segments = Array.isArray(path) ? path : path ? [path] : [];
  const frontendPath = buildFrontendPathFromSegments(segments);

  if (isBlockedMobilePath(frontendPath)) {
    return (
      <FrontendShellStatus
        title="Rota indisponível"
        message="Esta rota não está disponível no aplicativo móvel."
        targetUrl={buildFrontendUrl(ROOT_PATH)}
      />
    );
  }

  return <FrontendShellScreen path={frontendPath} />;
}
