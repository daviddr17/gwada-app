import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import type { SessionSummaryLineDto } from "@/src/lib/pos-api";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

function lineStatusLabel(line: SessionSummaryLineDto): string {
  if (line.linePaymentState === "paid") return "Bezahlt";
  if (line.linePaymentState === "partial") {
    return `${line.paidQuantity} von ${line.quantity} bezahlt`;
  }
  return "Offen";
}

type SessionLineRowProps = {
  line: SessionSummaryLineDto;
  selectedQty: number;
  onChangeQty: (qty: number) => void;
};

export function SessionLineRow({
  line,
  selectedQty,
  onChangeQty,
}: SessionLineRowProps) {
  const styles = useThemedStyles(createStyles);
  const isPaid = line.openQuantity <= 0;

  return (
    <View style={styles.lineRow}>
      <View style={styles.lineMain}>
        <Text style={styles.lineName}>
          {line.quantity}× {line.name}
        </Text>
        <Text style={styles.lineMeta}>
          {formatCentsEUR(line.lineTotalCents)} · {lineStatusLabel(line)}
        </Text>
      </View>
      {isPaid ? (
        <Text style={styles.paidBadge}>✓</Text>
      ) : (
        <View style={styles.stepper}>
          <Pressable
            onPress={() => onChangeQty(selectedQty - 1)}
            style={styles.stepBtn}
            disabled={selectedQty <= 0}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.stepValue}>{selectedQty}</Text>
          <Pressable
            onPress={() =>
              onChangeQty(Math.min(line.openQuantity, selectedQty + 1))
            }
            style={styles.stepBtn}
            disabled={selectedQty >= line.openQuantity}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function createSessionOrderSectionStyles(colors: GwadaColors) {
  return StyleSheet.create({
    header: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginTop: gwadaSpacing.sm,
      marginBottom: 4,
    },
  });
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    lineRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: gwadaRadii.card,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 8,
    },
    lineMain: { flex: 1, gap: 2 },
    lineName: { fontSize: 15, fontWeight: "600", color: colors.text },
    lineMeta: { fontSize: 13, color: colors.textMuted },
    paidBadge: {
      fontSize: 18,
      color: colors.success,
      fontWeight: "700",
      paddingHorizontal: 8,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: gwadaRadii.button,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    stepBtnText: {
      fontSize: 20,
      fontWeight: "600",
      color: colors.text,
    },
    stepValue: {
      minWidth: 24,
      textAlign: "center",
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
  });
}
