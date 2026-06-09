import { formatCentsEUR } from "@gwada/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

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
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
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
