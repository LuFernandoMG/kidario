import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/common/Screen";
import { FrontendConnectivityBanner } from "@/components/webview/FrontendConnectivityBanner";
import { FrontendShellLoading } from "@/components/webview/FrontendShellLoading";
import { FrontendShellStatus } from "@/components/webview/FrontendShellStatus";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { buildFrontendUrl } from "@/lib/frontendWeb";
import { theme } from "@/theme";

interface FrontendShellProps {
  path?: string;
}

const IFrame = "iframe" as unknown as React.ComponentType<Record<string, unknown>>;

export function FrontendShell({ path = "/" }: FrontendShellProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "offline">("loading");
  const networkStatus = useNetworkStatus();
  const targetUrl = buildFrontendUrl(path);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setStatus((current) => (current === "loading" ? "error" : current));
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [reloadKey, targetUrl]);

  useEffect(() => {
    if (networkStatus === "offline") {
      setStatus("offline");
      return;
    }

    if (networkStatus === "reconnecting") {
      setStatus("loading");
      setReloadKey((current) => current + 1);
    }
  }, [networkStatus]);

  if (status === "error" || status === "offline") {
    return (
      <FrontendShellStatus
        eyebrow="Web Debug Shell"
        title={status === "offline" ? "Browser is offline" : "Frontend did not load in time"}
        message={
          status === "offline"
            ? "The browser reported no network connection."
            : "The iframe shell did not finish loading. Confirm the frontend is running and reachable."
        }
        note="The web shell is intended only for local debugging while the real frontend runs separately."
        targetUrl={targetUrl}
        onRetry={() => {
          setStatus("loading");
          setReloadKey((current) => current + 1);
        }}
      />
    );
  }

  return (
    <Screen contentStyle={styles.screenContent}>
      <FrontendConnectivityBanner status={networkStatus} />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>WebView First</Text>
        <Text style={styles.title}>Kidario Frontend Shell</Text>
        <Text style={styles.body}>{targetUrl}</Text>
      </View>
      <View style={styles.frameContainer}>
        <IFrame
          key={reloadKey}
          onError={() => setStatus("error")}
          onLoad={() => setStatus("ready")}
          src={targetUrl}
          style={styles.frame}
          title="Kidario Frontend Shell"
        />
        {status === "loading" ? <FrontendShellLoading message="Waiting for the frontend shell to respond." mode="inline" /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: "flex-start",
  },
  header: {
    gap: theme.spacing.sm,
  },
  eyebrow: {
    fontSize: theme.typography.eyebrow.fontSize,
    lineHeight: theme.typography.eyebrow.lineHeight,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
    textTransform: "uppercase",
    color: theme.colors.eyebrow,
  },
  title: {
    fontSize: theme.typography.title.fontSize,
    lineHeight: theme.typography.title.lineHeight,
    fontWeight: theme.typography.title.fontWeight,
    color: theme.colors.textPrimary,
  },
  body: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.textSecondary,
  },
  frameContainer: {
    flex: 1,
    minHeight: 640,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  frame: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
  },
});
