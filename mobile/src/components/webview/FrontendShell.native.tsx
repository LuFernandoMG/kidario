import * as DocumentPicker from "expo-document-picker";
import { Linking } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewErrorEvent, WebViewHttpErrorEvent, WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";
import { useEffect, useRef, useState } from "react";

import { FrontendConnectivityBanner } from "@/components/webview/FrontendConnectivityBanner";
import { FrontendShellLoading } from "@/components/webview/FrontendShellLoading";
import { FrontendShellStatus } from "@/components/webview/FrontendShellStatus";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { buildFrontendUrl, isInternalFrontendUrl, isOpenableExternalUrl } from "@/lib/frontendWeb";
import {
  createUploadCanceledResult,
  createUploadErrorResult,
  createUploadResultScript,
  createUploadSuccessResult,
  frontendBridgeBootstrapScript,
  parseBridgeMessage,
} from "@/lib/webviewBridge";

interface FrontendShellProps {
  path?: string;
}

export function FrontendShell({ path = "/" }: FrontendShellProps) {
  const webViewRef = useRef<WebView | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "offline">("loading");
  const [message, setMessage] = useState("Loading the current Kidario frontend.");
  const networkStatus = useNetworkStatus();
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

  useEffect(() => {
    if (networkStatus === "reconnecting" && status !== "ready") {
      handleRetry();
      setMessage("Connection restored. Reloading the wrapped frontend.");
    }
  }, [networkStatus, status]);

  async function handleWebViewMessage(event: WebViewMessageEvent) {
    const payload = parseBridgeMessage(event.nativeEvent.data);
    if (!payload || payload.type !== "pick-document") {
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: Boolean(payload.allowMultiple),
        type: payload.accept?.length ? payload.accept : "*/*",
      });

      if (result.canceled) {
        webViewRef.current?.injectJavaScript(
          createUploadResultScript(createUploadCanceledResult(payload.requestId)),
        );
        return;
      }

      webViewRef.current?.injectJavaScript(
        createUploadResultScript(
          createUploadSuccessResult(
            payload.requestId,
            result.assets.map((asset) => ({
              name: asset.name,
              uri: asset.uri,
              mimeType: asset.mimeType ?? null,
              size: asset.size ?? null,
            })),
          ),
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The native document picker failed.";
      webViewRef.current?.injectJavaScript(
        createUploadResultScript(createUploadErrorResult(payload.requestId, message)),
      );
    }
  }

  if (status === "error" || status === "offline") {
    return (
      <FrontendShellStatus
        title={status === "offline" ? "Frontend unavailable" : "Shell load failed"}
        message={message}
        note="Try again in a moment."
        targetUrl={targetUrl}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <>
      <FrontendConnectivityBanner status={networkStatus} />
      <WebView
        key={reloadKey}
        ref={webViewRef}
        allowsBackForwardNavigationGestures
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={frontendBridgeBootstrapScript}
        onError={handleWebViewError}
        onHttpError={handleWebViewHttpError}
        onLoadEnd={() => {
          setStatus("ready");
        }}
        onLoadStart={() => {
          setStatus("loading");
          setMessage("Loading the current Kidario frontend.");
        }}
        onMessage={(event) => {
          void handleWebViewMessage(event);
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
        sharedCookiesEnabled
        source={{ uri: targetUrl }}
        startInLoadingState
        renderLoading={() => (
          <FrontendShellLoading message={message} targetUrl={targetUrl} />
        )}
      />
    </>
  );
}
