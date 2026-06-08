import { formatCentsEUR } from "@gwada/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
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
  return <Text style={styles.money}>{formatCentsEUR(cents)}</Text>;
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
    marginBottom: gwadaSpacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: gwadaColors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: gwadaColors.textMuted,
  },
  card: {
    backgroundColor: gwadaColors.surface,
    borderRadius: gwadaRadii.card,
    borderWidth: 1,
    borderColor: gwadaColors.border,
    padding: gwadaSpacing.md,
  },
  cardPressed: {
    opacity: 0.92,
  },
  money: {
    fontSize: 16,
    fontWeight: "600",
    color: gwadaColors.text,
  },
});
