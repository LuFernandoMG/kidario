import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/common/Screen";
import { theme } from "@/theme";

function EntryAction({
  href,
  title,
  description,
  variant = "secondary",
}: {
  href: string;
  title: string;
  description: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.actionCard,
          variant === "primary" ? styles.primaryCard : styles.secondaryCard,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.actionTitle, variant === "primary" ? styles.primaryTitle : null]}>{title}</Text>
        <Text style={[styles.actionDescription, variant === "primary" ? styles.primaryDescription : null]}>
          {description}
        </Text>
      </Pressable>
    </Link>
  );
}

export function NativeEntryHub() {
  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Native Entry Flow</Text>
        <Text style={styles.title}>Kidario mobile starts here</Text>
        <Text style={styles.body}>
          This first native surface routes users into the existing frontend without duplicating product logic.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Shared</Text>
        <EntryAction
          href="/login"
          title="Login"
          description="Open the wrapped login flow."
          variant="primary"
        />
        <EntryAction
          href="/welcome-shell"
          title="Open wrapped welcome"
          description="Open the current frontend root exactly as it exists on web."
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Parent</Text>
        <EntryAction href="/signup" title="Create account" description="Go directly to parent signup." />
        <EntryAction href="/explore" title="Explore teachers" description="Enter the marketplace flow." />
        <EntryAction href="/agenda" title="Open agenda" description="Jump into the current parent agenda shell." />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Teacher</Text>
        <EntryAction href="/home" title="Teacher home" description="Open the current teacher control center." />
        <EntryAction
          href="/private-signup"
          title="Private signup"
          description="Open the private teacher invitation route."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "flex-start",
  },
  hero: {
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
  },
  body: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.textSecondary,
    maxWidth: 480,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.link.fontSize,
    lineHeight: theme.typography.link.lineHeight,
    fontWeight: theme.typography.link.fontWeight,
    color: theme.colors.textPrimary,
  },
  actionCard: {
    borderRadius: 24,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    borderWidth: 1,
    gap: theme.spacing.sm,
  },
  primaryCard: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  secondaryCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  pressed: {
    opacity: 0.88,
  },
  actionTitle: {
    fontSize: theme.typography.link.fontSize,
    lineHeight: theme.typography.link.lineHeight,
    fontWeight: theme.typography.link.fontWeight,
    color: theme.colors.textPrimary,
  },
  primaryTitle: {
    color: theme.colors.surface,
  },
  actionDescription: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    color: theme.colors.textSecondary,
  },
  primaryDescription: {
    color: theme.colors.surface,
  },
});
