import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type MenuSectionProps = {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function MenuSection({ title, children, style }: MenuSectionProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: gwadaRadii.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: gwadaSpacing.md,
      gap: gwadaSpacing.sm,
    },
    title: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 4,
    },
  });
}
