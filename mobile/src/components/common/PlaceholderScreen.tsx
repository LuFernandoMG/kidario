import { Link, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/common/Screen";
import { theme } from "@/theme";

interface PlaceholderLink {
  href: Href;
  label: string;
}

interface PlaceholderScreenProps {
  eyebrow: string;
  title: string;
  description: string;
  links?: PlaceholderLink[];
}

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  links = [],
}: PlaceholderScreenProps) {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.links}>
          {links.map((link) => (
            <Link key={`${link.href}`} href={link.href} style={styles.link}>
              {link.label}
            </Link>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
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
  description: {
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: theme.typography.body.fontWeight,
    color: theme.colors.textSecondary,
  },
  links: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  link: {
    fontSize: theme.typography.link.fontSize,
    lineHeight: theme.typography.link.lineHeight,
    fontWeight: theme.typography.link.fontWeight,
    color: theme.colors.accent,
  },
});
