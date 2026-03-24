import { StyleSheet, Text, View } from "react-native";

import type { NetworkStatus } from "@/hooks/useNetworkStatus";
import { theme } from "@/theme";

interface FrontendConnectivityBannerProps {
  status: NetworkStatus;
}

export function FrontendConnectivityBanner({ status }: FrontendConnectivityBannerProps) {
  if (status === "online") {
    return null;
  }

  return (
    <View style={[styles.banner, status === "offline" ? styles.offline : styles.reconnecting]}>
      <Text style={styles.text}>
        {status === "offline"
          ? "You are offline. The wrapped frontend may stop updating until the connection returns."
          : "Connection restored. Reloading the wrapped frontend."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    zIndex: 10,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  offline: {
    backgroundColor: "#7f2f1f",
  },
  reconnecting: {
    backgroundColor: "#386641",
  },
  text: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.surface,
    textAlign: "center",
  },
});
