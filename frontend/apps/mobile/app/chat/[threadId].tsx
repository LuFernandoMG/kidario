import { useLocalSearchParams } from "expo-router";

import { FrontendShellScreen } from "@/components/webview/FrontendShellScreen";
import { buildChatPath } from "@/routes/frontend";

export default function ChatScreen() {
  const { threadId } = useLocalSearchParams<{ threadId?: string | string[] }>();
  const normalizedThreadId = Array.isArray(threadId) ? threadId[0] : threadId;

  return <FrontendShellScreen path={buildChatPath(normalizedThreadId ?? "")} />;
}
