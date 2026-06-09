import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing, screenTypography } from "@/src/theme/tokens";

type GroupedSectionProps = {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function GroupedSection({
  title,
  footer,
  children,
  style,
}: GroupedSectionProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.wrap, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      gap: gwadaSpacing.xs,
    },
    title: {
      ...screenTypography.sectionTitle,
      color: colors.textMuted,
      paddingHorizontal: gwadaSpacing.md,
      marginBottom: 2,
    },
    footer: {
      fontSize: 13,
      color: colors.textMuted,
      paddingHorizontal: gwadaSpacing.md,
      marginTop: 2,
      lineHeight: 18,
    },
  });
}
