import { StyleSheet, Text, View } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { Card } from "@/src/components/ui";
import { useOccupiedDuration } from "@/src/lib/hooks/use-occupied-duration";
import type { SessionSummaryDto } from "@/src/lib/pos-api";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

type SessionSummaryCardProps = {
  tableLabel: string;
  capacity: number | null;
  summary: SessionSummaryDto;
};

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function SessionSummaryCard({
  tableLabel,
  capacity,
  summary,
}: SessionSummaryCardProps) {
  const durationLabel = useOccupiedDuration(summary.openedAt);
  const orderCount = summary.orders.length;
  const paymentCount = summary.payments.length;

  return (
    <Card>
      <Text style={styles.title}>{tableLabel}</Text>
      <Text style={styles.meta}>
        {summary.coverCount} Personen
        {capacity != null && Number.isFinite(capacity) ? ` · ${capacity} Plätze` : ""}
      </Text>

      <View style={styles.timeRow}>
        <View style={styles.timeCell}>
          <Text style={styles.timeLabel}>Belegt seit</Text>
          <Text style={styles.timeValue}>{formatDateTime(summary.openedAt)}</Text>
        </View>
        <View style={styles.timeDivider} />
        <View style={styles.timeCell}>
          <Text style={styles.timeLabel}>Dauer</Text>
          <Text style={styles.timeValue}>{durationLabel}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCell label="Offen" value={formatCentsEUR(summary.openCents)} />
        <StatCell label="Bezahlt" value={formatCentsEUR(summary.paidCents)} />
        <StatCell label="Gesamt" value={formatCentsEUR(summary.totalCents)} />
      </View>

      <Text style={styles.footerMeta}>
        {orderCount} {orderCount === 1 ? "Bestellung" : "Bestellungen"}
        {" · "}
        {paymentCount} {paymentCount === 1 ? "Zahlung" : "Zahlungen"}
        {summary.openLineCount > 0
          ? ` · ${summary.openLineCount} offene Position${summary.openLineCount === 1 ? "" : "en"}`
          : ""}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  meta: {
    fontSize: 14,
    color: gwadaColors.textMuted,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: gwadaSpacing.md,
    paddingTop: gwadaSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: gwadaColors.border,
  },
  timeCell: {
    flex: 1,
    gap: 2,
  },
  timeDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: gwadaColors.border,
    marginHorizontal: gwadaSpacing.sm,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: gwadaColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: "600",
    color: gwadaColors.text,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: gwadaSpacing.md,
  },
  statCell: {
    flex: 1,
    backgroundColor: gwadaColors.background,
    borderRadius: gwadaRadii.button,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: gwadaColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  footerMeta: {
    fontSize: 13,
    color: gwadaColors.textMuted,
    marginTop: gwadaSpacing.sm,
    textAlign: "center",
  },
});
