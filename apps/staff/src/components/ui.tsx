import { formatCentsEUR } from "@gwada/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing, screenTypography } from "@/src/theme/tokens";

export { GroupedSection } from "./ui/GroupedSection";
export { GroupedList } from "./ui/GroupedList";
export { ListRow, type ListRowVariant } from "./ui/ListRow";
export { ListSeparator } from "./ui/ListSeparator";
export { SegmentedControl } from "./ui/SegmentedControl";
export { FormTextField } from "./ui/FormTextField";

export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const styles = useThemedStyles(createHeaderStyles);

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const styles = useThemedStyles(createCardStyles);

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={styles.card}>{children}</View>;
}

export function MoneyText({ cents }: { cents: number }) {
  const styles = useThemedStyles(createMoneyStyles);
  return <Text style={styles.money}>{formatCentsEUR(cents)}</Text>;
}

function createHeaderStyles(colors: GwadaColors) {
  return StyleSheet.create({
    header: {
      gap: 4,
      marginBottom: gwadaSpacing.md,
    },
    title: {
      ...screenTypography.title,
      color: colors.text,
    },
    subtitle: {
      ...screenTypography.subtitle,
      color: colors.textMuted,
    },
  });
}

function createCardStyles(colors: GwadaColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: gwadaRadii.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: gwadaSpacing.md,
    },
    cardPressed: {
      opacity: 0.92,
    },
  });
}

function createMoneyStyles(colors: GwadaColors) {
  return StyleSheet.create({
    money: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
  });
}
