import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/common/Screen";
import { theme } from "@/theme";

export function BootSplash() {
  return (
    <Screen>
      <View style={styles.shell}>
        <Text style={styles.eyebrow}>Kidario Mobile</Text>
        <Text style={styles.title}>Launching the shell</Text>
        <Text style={styles.body}>Preparing the mobile wrapper around the current frontend.</Text>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    gap: theme.spacing.md,
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
    textAlign: "center",
  },
  body: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },
});
