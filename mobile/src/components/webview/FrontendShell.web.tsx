import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/common/Screen";
import { FrontendShellStatus } from "@/components/webview/FrontendShellStatus";
import { buildFrontendUrl } from "@/lib/frontendWeb";
import { theme } from "@/theme";

interface FrontendShellProps {
  path?: string;
}

const IFrame = "iframe" as unknown as React.ComponentType<Record<string, unknown>>;

export function FrontendShell({ path = "/" }: FrontendShellProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "offline">(() =>
    typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "loading",
  );
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
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleOnline = () => setStatus("loading");
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
        {status === "loading" ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingTitle}>Loading Kidario</Text>
            <Text style={styles.loadingBody}>Waiting for the frontend shell to respond.</Text>
          </View>
        ) : null}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    backgroundColor: "rgba(255, 250, 243, 0.94)",
    paddingHorizontal: theme.spacing.xl,
  },
  loadingTitle: {
    fontSize: theme.typography.link.fontSize,
    lineHeight: theme.typography.link.lineHeight,
    fontWeight: theme.typography.link.fontWeight,
    color: theme.colors.textPrimary,
  },
  loadingBody: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
});
