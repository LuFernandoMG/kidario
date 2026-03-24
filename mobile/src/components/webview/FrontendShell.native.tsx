import { Linking } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from "react-native-webview/lib/WebViewTypes";
import { useState } from "react";

import { FrontendShellLoading } from "@/components/webview/FrontendShellLoading";
import { FrontendShellStatus } from "@/components/webview/FrontendShellStatus";
import { buildFrontendUrl, isInternalFrontendUrl, isOpenableExternalUrl } from "@/lib/frontendWeb";

interface FrontendShellProps {
  path?: string;
}

export function FrontendShell({ path = "/" }: FrontendShellProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "offline">("loading");
  const [message, setMessage] = useState("Loading the current Kidario frontend.");
  const targetUrl = buildFrontendUrl(path);

  function handleRetry() {
    setStatus("loading");
    setMessage("Retrying the current Kidario frontend.");
    setReloadKey((current) => current + 1);
  }

  function handleShellError(nextMessage: string) {
    const normalizedMessage = nextMessage.toLowerCase();
    const isOffline =
      normalizedMessage.includes("offline") ||
      normalizedMessage.includes("internet") ||
      normalizedMessage.includes("timed out") ||
      normalizedMessage.includes("dns");

    setStatus(isOffline ? "offline" : "error");
    setMessage(nextMessage);
  }

  function handleWebViewError(event: WebViewErrorEvent) {
    handleShellError(event.nativeEvent.description || "The mobile shell could not load the frontend.");
  }

  function handleWebViewHttpError(event: WebViewHttpErrorEvent) {
    handleShellError(`The frontend responded with HTTP ${event.nativeEvent.statusCode}.`);
  }

  if (status === "error" || status === "offline") {
    return (
      <FrontendShellStatus
        eyebrow="Native Shell"
        title={status === "offline" ? "Frontend unavailable" : "Shell load failed"}
        message={message}
        note="Keep the frontend server running separately while developing the shell."
        targetUrl={targetUrl}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <WebView
      key={reloadKey}
      allowsBackForwardNavigationGestures
      onError={handleWebViewError}
      onHttpError={handleWebViewHttpError}
      onLoadEnd={() => {
        setStatus("ready");
      }}
      onLoadStart={() => {
        setStatus("loading");
        setMessage("Loading the current Kidario frontend.");
      }}
      onShouldStartLoadWithRequest={(request) => {
        if (isInternalFrontendUrl(request.url) || request.url === targetUrl) {
          return true;
        }

        if (isOpenableExternalUrl(request.url)) {
          void Linking.openURL(request.url);
        }

        return false;
      }}
      originWhitelist={["http://*", "https://*", "about:blank"]}
      source={{ uri: targetUrl }}
      startInLoadingState
      renderLoading={() => (
        <FrontendShellLoading message={message} targetUrl={targetUrl} />
      )}
    />
  );
}
