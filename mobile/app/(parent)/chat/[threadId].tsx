import { useLocalSearchParams } from "expo-router";

import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { buildFrontendChatPath, frontendRoutes } from "@/routes/frontend";

export default function ParentChatScreen() {
  const params = useLocalSearchParams<{ threadId?: string | string[] }>();
  const threadId = Array.isArray(params.threadId) ? params.threadId[0] : params.threadId;

  if (!threadId) {
    return <FrontendShellScreen path={frontendRoutes.parent.profile} />;
  }

  return <FrontendShellScreen path={buildFrontendChatPath(threadId)} />;
}
