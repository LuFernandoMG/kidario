import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/common/Screen";
import { theme } from "@/theme";

interface FrontendShellStatusProps {
  title: string;
  message: string;
  targetUrl: string;
  note?: string;
  retryLabel?: string;
  onRetry?: () => void;
  showDebugUrl?: boolean;
}

export function FrontendShellStatus({
  title,
  message,
  targetUrl,
  note,
  retryLabel = "Tentar novamente",
  onRetry,
  showDebugUrl = false,
}: FrontendShellStatusProps) {
  return (
    <Screen contentStyle={styles.screenContent}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{message}</Text>
        {showDebugUrl ? <Text style={styles.url}>{targetUrl}</Text> : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        <View style={styles.actions}>
          {onRetry ? (
            <Pressable onPress={onRetry} style={[styles.button, styles.primaryButton]}>
              <Text style={[styles.buttonText, styles.primaryButtonText]}>{retryLabel}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void Linking.openURL(targetUrl)} style={[styles.button, styles.secondaryButton]}>
            <Text style={styles.buttonText}>Abrir no navegador</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: "center",
  },
  card: {
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
  url: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.accent,
    textAlign: "center",
  },
  note: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
  },
  secondaryButton: {
    backgroundColor: theme.colors.canvas,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    fontSize: theme.typography.link.fontSize,
    lineHeight: theme.typography.link.lineHeight,
    fontWeight: theme.typography.link.fontWeight,
    color: theme.colors.textPrimary,
  },
  primaryButtonText: {
    color: theme.colors.surface,
  },
});
