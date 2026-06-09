import { Pressable, StyleSheet, Text } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { useOccupiedDuration } from "@/src/lib/hooks/use-occupied-duration";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type SessionMiniHeaderProps = {
  tableLabel: string;
  openCents: number;
  openedAt: string;
  onPress: () => void;
};

export function SessionMiniHeader({
  tableLabel,
  openCents,
  openedAt,
  onPress,
}: SessionMiniHeaderProps) {
  const duration = useOccupiedDuration(openedAt);
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Session-Details einblenden"
      accessibilityHint="Scrollt nach oben und blendet Statistik ein"
    >
      <Text style={styles.text} numberOfLines={1}>
        {tableLabel} · Offen {formatCentsEUR(openCents)} · {duration}
      </Text>
      <Text style={styles.hint}>▲</Text>
    </Pressable>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: gwadaRadii.button,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: gwadaSpacing.md,
      paddingVertical: 10,
    },
    pressed: {
      opacity: 0.88,
    },
    text: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    hint: {
      fontSize: 11,
      color: colors.textMuted,
    },
  });
}
