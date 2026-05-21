import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/common/Screen";
import { theme } from "@/theme";

interface FrontendShellLoadingProps {
  message: string;
  targetUrl?: string;
  mode?: "fullscreen" | "inline";
  showDebugUrl?: boolean;
}

export function FrontendShellLoading({
  message,
  targetUrl,
  mode = "fullscreen",
  showDebugUrl = false,
}: FrontendShellLoadingProps) {
  const content = (
    <View style={styles.content}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      <Text style={styles.title}>Abrindo Kidario</Text>
      <Text style={styles.body}>{message}</Text>
      {showDebugUrl && targetUrl ? <Text style={styles.url}>{targetUrl}</Text> : null}
    </View>
  );

  if (mode === "inline") {
    return <View style={styles.inlineContainer}>{content}</View>;
  }

  return <Screen>{content}</Screen>;
}

const styles = StyleSheet.create({
  inlineContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 250, 243, 0.94)",
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    alignItems: "center",
    gap: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.title.fontSize,
    lineHeight: theme.typography.title.lineHeight,
    fontWeight: theme.typography.title.fontWeight,
    color: theme.colors.textPrimary,
    textAlign: "center",
  },
  body: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },
  url: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.accent,
    textAlign: "center",
    maxWidth: 320,
  },
});
