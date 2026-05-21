import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export const theme = {
  colors,
  spacing,
  typography,
} as const;

export type AppTheme = typeof theme;
