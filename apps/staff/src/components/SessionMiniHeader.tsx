import { Pressable, StyleSheet, Text } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { useOccupiedDuration } from "@/src/lib/hooks/use-occupied-duration";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: gwadaColors.surface,
    borderRadius: gwadaRadii.button,
    borderWidth: 1,
    borderColor: gwadaColors.border,
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
    color: gwadaColors.text,
  },
  hint: {
    fontSize: 11,
    color: gwadaColors.textMuted,
  },
});
