import { View, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { gwadaColors, gwadaSpacing } from "@/src/theme/tokens";

type SessionPayBarProps = {
  selectedCents: number;
  paying: boolean;
  onPay: () => void;
};

export function SessionPayBar({
  selectedCents,
  paying,
  onPay,
}: SessionPayBarProps) {
  const insets = useSafeAreaInsets();
  const canPay = selectedCents > 0;

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, gwadaSpacing.md) },
      ]}
    >
      <View style={styles.summary}>
        <Text style={styles.label}>Auswahl</Text>
        <Text style={styles.amount}>{formatCentsEUR(selectedCents)}</Text>
      </View>
      <Button
        label="Bar kassieren"
        onPress={onPay}
        loading={paying}
        disabled={!canPay}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: gwadaColors.border,
    backgroundColor: gwadaColors.surface,
    paddingHorizontal: gwadaSpacing.lg,
    paddingTop: gwadaSpacing.md,
    gap: gwadaSpacing.sm,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    color: gwadaColors.textMuted,
  },
  amount: {
    fontSize: 20,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  button: {
    width: "100%",
  },
});
