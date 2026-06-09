import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { allocationAmountCents } from "@gwada/pos-domain";
import type { SessionSummaryLineDto } from "@/src/lib/pos-api";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

export type LineSelection = Record<string, number>;

type SessionLinePickerProps = {
  orders: Array<{ orderNumber: number; lines: SessionSummaryLineDto[] }>;
  selection: LineSelection;
  onChangeSelection: (next: LineSelection) => void;
};

function lineStatusLabel(line: SessionSummaryLineDto): string {
  if (line.linePaymentState === "paid") return "Bezahlt";
  if (line.linePaymentState === "partial") {
    return `${line.paidQuantity} von ${line.quantity} bezahlt`;
  }
  return "Offen";
}

export function SessionLinePicker({
  orders,
  selection,
  onChangeSelection,
}: SessionLinePickerProps) {
  const styles = useThemedStyles(createStyles);

  const setQty = (line: SessionSummaryLineDto, qty: number) => {
    const next = { ...selection };
    if (qty <= 0) {
      delete next[line.id];
    } else {
      next[line.id] = qty;
    }
    onChangeSelection(next);
  };

  return (
    <View style={styles.wrap}>
      {orders.map((order) => (
        <View key={order.orderNumber} style={styles.orderBlock}>
          <Text style={styles.orderTitle}>Bestellung #{order.orderNumber}</Text>
          {order.lines.map((line) => {
            const selectedQty = selection[line.id] ?? 0;
            const isPaid = line.openQuantity <= 0;
            return (
              <View key={line.id} style={styles.lineRow}>
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
                      onPress={() => setQty(line, selectedQty - 1)}
                      style={styles.stepBtn}
                      disabled={selectedQty <= 0}
                    >
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepValue}>{selectedQty}</Text>
                    <Pressable
                      onPress={() =>
                        setQty(
                          line,
                          Math.min(line.openQuantity, selectedQty + 1),
                        )
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
          })}
        </View>
      ))}
    </View>
  );
}

export function computeSelectionTotalCents(
  orders: Array<{ lines: SessionSummaryLineDto[] }>,
  selection: LineSelection,
): number {
  let total = 0;
  for (const order of orders) {
    for (const line of order.lines) {
      const qty = selection[line.id] ?? 0;
      if (qty <= 0) continue;
      total += allocationAmountCents(
        line.lineTotalCents,
        line.quantity,
        qty,
      );
    }
  }
  return total;
}

export function buildAllocationsFromSelection(
  selection: LineSelection,
): Array<{ orderLineId: string; quantity: number }> {
  return Object.entries(selection)
    .filter(([, qty]) => qty > 0)
    .map(([orderLineId, quantity]) => ({ orderLineId, quantity }));
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    wrap: { gap: gwadaSpacing.md },
    orderBlock: { gap: 8 },
    orderTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
    },
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
