import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { ReceiptViewerModal } from "@/src/components/ReceiptViewerModal";
import { SkeletonList } from "@/src/components/Skeleton";
import { Card } from "@/src/components/ui";
import {
  collectCash,
  fetchOrder,
  retryFiskalySigning,
} from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [retryingTse, setRetryingTse] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["pos-order", restaurantId, id],
    enabled: Boolean(restaurantId && id),
    queryFn: async () => {
      const res = await fetchOrder(restaurantId!, id!);
      return res.order;
    },
  });

  const showSkeleton = useDeferredSkeleton(isLoading);

  const handleRetryTse = async () => {
    if (!restaurantId || !id) return;
    setRetryingTse(true);
    try {
      await retryFiskalySigning({ restaurantId, orderId: id });
      await refetch();
      Alert.alert("TSE", "Signatur erneut angefordert.");
    } catch (err) {
      Alert.alert("TSE fehlgeschlagen", posApiErrorMessage(err, "Unbekannter Fehler"));
    } finally {
      setRetryingTse(false);
    }
  };

  const handleCashPay = async () => {
    if (!restaurantId || !id || !order) return;
    setPaying(true);
    try {
      await collectCash({ restaurantId, orderId: id });
      await refetch();
      await queryClient.invalidateQueries({
        queryKey: ["pos-active-orders", restaurantId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["pos-paid-today-orders", restaurantId],
      });
      Alert.alert("Bezahlt", "Barzahlung erfasst.");
    } catch (err) {
      Alert.alert(
        "Zahlung fehlgeschlagen",
        posApiErrorMessage(err, "Unbekannter Fehler"),
      );
    } finally {
      setPaying(false);
    }
  };

  if (showSkeleton) {
    return (
      <View style={styles.container}>
        <SkeletonList count={4} />
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={styles.container}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Bestellung konnte nicht geladen werden</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : "Unbekannter Fehler"}
          </Text>
          <Button label="Erneut laden" onPress={() => void refetch()} />
        </View>
      </View>
    );
  }

  const canPayCash = order.paymentState !== "paid";
  const displayReceiptUrl =
    order.receiptUrl ?? order.fiscal?.receiptPublicUrl ?? null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card>
        <Text style={styles.orderNo}>Bestellung #{order.orderNumber}</Text>
        <Text style={styles.meta}>Status: {order.status}</Text>
        <Text style={styles.meta}>Zahlung: {order.paymentState}</Text>
        <Text style={styles.total}>{formatCentsEUR(order.totalCents)}</Text>
      </Card>

      <Text style={styles.section}>Positionen</Text>
      {order.lines.map((line) => (
        <Card key={line.id}>
          <Text style={styles.lineName}>
            {line.quantity}× {line.name}
          </Text>
          <Text style={styles.linePrice}>
            {formatCentsEUR(line.lineTotalCents)}
          </Text>
        </Card>
      ))}

      {order.fiskalyFailedAt ? (
        <View style={styles.warnBox}>
          <Text style={styles.warn}>
            TSE-Signatur fehlgeschlagen. Erneut versuchen oder Support
            kontaktieren.
          </Text>
          <Button
            label="TSE erneut signieren"
            variant="secondary"
            loading={retryingTse}
            onPress={() => void handleRetryTse()}
          />
        </View>
      ) : null}

      {canPayCash ? (
        <Button
          label="Bar bezahlen"
          loading={paying}
          onPress={() => void handleCashPay()}
          style={styles.payBtn}
        />
      ) : (
        <Text style={styles.paidHint}>Vollständig bezahlt</Text>
      )}

      {displayReceiptUrl ? (
        <Button
          label="Beleg anzeigen"
          variant="secondary"
          onPress={() => setReceiptOpen(true)}
          style={styles.receiptBtn}
        />
      ) : null}

      {displayReceiptUrl ? (
        <ReceiptViewerModal
          visible={receiptOpen}
          url={displayReceiptUrl}
          title={`Beleg #${order.orderNumber}`}
          onClose={() => setReceiptOpen(false)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: gwadaSpacing.lg,
    gap: 10,
    backgroundColor: gwadaColors.background,
  },
  orderNo: { fontSize: 20, fontWeight: "700", color: gwadaColors.text },
  meta: { fontSize: 14, color: gwadaColors.textMuted, marginTop: 4 },
  total: {
    fontSize: 22,
    fontWeight: "700",
    color: gwadaColors.text,
    marginTop: 12,
  },
  section: {
    fontSize: 16,
    fontWeight: "600",
    color: gwadaColors.text,
    marginTop: gwadaSpacing.md,
    marginBottom: 4,
  },
  lineName: { fontSize: 15, fontWeight: "600", color: gwadaColors.text },
  linePrice: { fontSize: 14, color: gwadaColors.textMuted, marginTop: 4 },
  warnBox: { gap: gwadaSpacing.sm, marginTop: gwadaSpacing.sm },
  warn: { color: gwadaColors.destructive, fontSize: 14 },
  payBtn: { marginTop: gwadaSpacing.lg },
  receiptBtn: { marginTop: gwadaSpacing.sm },
  paidHint: {
    textAlign: "center",
    color: gwadaColors.success,
    fontWeight: "600",
    marginTop: gwadaSpacing.lg,
  },
  errorBox: {
    gap: gwadaSpacing.sm,
    padding: gwadaSpacing.lg,
    borderRadius: gwadaRadii.card,
    borderWidth: 1,
    borderColor: gwadaColors.border,
    backgroundColor: gwadaColors.surface,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: gwadaColors.text,
  },
  errorText: {
    fontSize: 14,
    color: gwadaColors.destructive,
    lineHeight: 20,
  },
});
