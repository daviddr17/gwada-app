import { StyleSheet, Text, View } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { Card } from "@/src/components/ui";
import type { SessionSummaryPaymentDto } from "@/src/lib/pos-api";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

const METHOD_LABELS: Record<string, string> = {
  cash: "Bar",
  card: "Karte",
  paypal: "PayPal",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

type SessionPaymentsListProps = {
  payments: SessionSummaryPaymentDto[];
  onOpenReceipt: (payment: SessionSummaryPaymentDto) => void;
};

export function SessionPaymentsList({
  payments,
  onOpenReceipt,
}: SessionPaymentsListProps) {
  return (
    <View style={styles.list}>
      {payments.map((payment) => (
        <Card key={payment.id}>
          <View style={styles.headerRow}>
            <Text style={styles.amount}>{formatCentsEUR(payment.amountCents)}</Text>
            <Text style={styles.method}>{methodLabel(payment.method)}</Text>
          </View>
          <Text style={styles.meta}>
            {formatDateTime(payment.paidAt)}
            {payment.orderNumber > 0
              ? ` · Bestellung #${payment.orderNumber}`
              : ""}
          </Text>
          {payment.tipCents > 0 ? (
            <Text style={styles.meta}>
              Trinkgeld: {formatCentsEUR(payment.tipCents)}
            </Text>
          ) : null}

          {payment.allocations.length > 0 ? (
            <View style={styles.allocations}>
              {payment.allocations.map((line) => (
                <Text key={line.orderLineId} style={styles.allocationLine}>
                  {line.quantity}× {line.name}
                  {line.orderNumber > 0 ? ` (#${line.orderNumber})` : ""}
                  {" · "}
                  {formatCentsEUR(line.amountCents)}
                </Text>
              ))}
            </View>
          ) : null}

          {payment.receiptUrl ? (
            <Button
              label="Beleg anzeigen"
              variant="secondary"
              onPress={() => onOpenReceipt(payment)}
              style={styles.receiptBtn}
            />
          ) : (
            <Text style={styles.noReceipt}>Beleg wird erstellt …</Text>
          )}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: gwadaSpacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: gwadaSpacing.sm,
  },
  amount: {
    fontSize: 18,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  method: {
    fontSize: 13,
    fontWeight: "600",
    color: gwadaColors.textMuted,
    backgroundColor: gwadaColors.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: gwadaRadii.pill,
    overflow: "hidden",
  },
  meta: {
    fontSize: 13,
    color: gwadaColors.textMuted,
    marginTop: 4,
  },
  allocations: {
    marginTop: gwadaSpacing.sm,
    gap: 4,
  },
  allocationLine: {
    fontSize: 14,
    color: gwadaColors.text,
    lineHeight: 20,
  },
  receiptBtn: {
    marginTop: gwadaSpacing.sm,
  },
  noReceipt: {
    marginTop: gwadaSpacing.sm,
    fontSize: 13,
    color: gwadaColors.textMuted,
    fontStyle: "italic",
  },
});
