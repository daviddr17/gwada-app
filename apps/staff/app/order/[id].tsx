import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { ReceiptViewerModal } from "@/src/components/ReceiptViewerModal";
import { SkeletonList } from "@/src/components/Skeleton";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { GroupedSection } from "@/src/components/ui/GroupedSection";
import { ListRow } from "@/src/components/ui/ListRow";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import {
  collectCash,
  fetchOrder,
  retryFiskalySigning,
} from "@/src/lib/pos-api";
import { useMollieCheckout } from "@/src/components/MollieCheckoutModal";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { orderStatusLabel, paymentStateLabel } from "@/src/lib/ui/status-labels";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { useAuthStore } from "@/src/stores/auth-store";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [payingMollie, setPayingMollie] = useState<"card" | "paypal" | null>(
    null,
  );
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

  const styles = useThemedStyles(createStyles);
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
        queryKey: ["session-summary", restaurantId],
      });
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

  const refreshAfterPayment = async () => {
    if (!restaurantId) return;
    await refetch();
    await queryClient.invalidateQueries({
      queryKey: ["session-summary", restaurantId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["pos-active-orders", restaurantId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["pos-paid-today-orders", restaurantId],
    });
    Alert.alert("Bezahlt", "Zahlung erfasst.");
  };

  const { startPayment, starting: mollieStarting, modal: mollieModal } =
    useMollieCheckout({
      restaurantId: restaurantId ?? undefined,
      onSuccess: () => void refreshAfterPayment(),
      onFailed: (msg) => Alert.alert("Zahlung fehlgeschlagen", msg),
    });

  const handleMolliePay = async (method: "card" | "paypal") => {
    if (!id) return;
    setPayingMollie(method);
    try {
      await startPayment({ method, orderId: id });
    } catch (err) {
      Alert.alert(
        "Zahlung fehlgeschlagen",
        err instanceof Error ? err.message : posApiErrorMessage(err, "Unbekannter Fehler"),
      );
    } finally {
      setPayingMollie(null);
    }
  };

  if (showSkeleton) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <SkeletonList count={4} />
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.errorBox}>
          <Text allowFontScaling style={styles.errorTitle}>
            Bestellung konnte nicht geladen werden
          </Text>
          <Text allowFontScaling style={styles.errorText}>
            {error instanceof Error ? error.message : "Unbekannter Fehler"}
          </Text>
          <Button label="Erneut laden" onPress={() => void refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const canPayCash = order.paymentState !== "paid";
  const displayReceiptUrl =
    order.receiptUrl ?? order.fiscal?.receiptPublicUrl ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <GroupedSection>
          <GroupedList>
            <ListRow
              label="Bestellung"
              value={`#${order.orderNumber}`}
              variant="value"
            />
            <ListSeparator />
            <ListRow
              label="Status"
              value={orderStatusLabel(order.status)}
              variant="value"
            />
            <ListSeparator />
            <ListRow
              label="Zahlung"
              value={paymentStateLabel(order.paymentState)}
              variant="value"
            />
            <ListSeparator />
            <ListRow
              label="Summe"
              value={formatCentsEUR(order.totalCents)}
              variant="value"
            />
          </GroupedList>
        </GroupedSection>

        <GroupedSection title="Positionen">
          <GroupedList>
            {order.lines.map((line, index) => {
              const paidQty = line.paidQuantity ?? 0;
              const openQty =
                line.openQuantity ?? Math.max(0, line.quantity - paidQty);
              const detail =
                openQty > 0 && openQty < line.quantity
                  ? `${paidQty} bezahlt, ${openQty} offen`
                  : openQty === 0
                    ? "bezahlt"
                    : "offen";

              return (
                <View key={line.id}>
                  {index > 0 ? <ListSeparator /> : null}
                  <ListRow
                    label={`${line.quantity}× ${line.name}`}
                    value={`${formatCentsEUR(line.lineTotalCents)} · ${detail}`}
                    variant="value"
                  />
                </View>
              );
            })}
          </GroupedList>
        </GroupedSection>

        {order.fiskalyFailedAt ? (
          <GroupedSection>
            <GroupedList>
              <ListRow
                label="TSE-Signatur fehlgeschlagen"
                variant="navigation"
                onPress={() => void handleRetryTse()}
              />
            </GroupedList>
          </GroupedSection>
        ) : null}

        <GroupedSection>
          <GroupedList>
            {canPayCash ? (
              <>
                <ListRow
                  label={paying ? "Wird bezahlt …" : "Rest bar bezahlen"}
                  variant="navigation"
                  onPress={() => !paying && !mollieStarting && void handleCashPay()}
                />
                <ListSeparator />
                <ListRow
                  label={
                    payingMollie === "card" || mollieStarting
                      ? "Karte wird geöffnet …"
                      : "Mit Karte bezahlen"
                  }
                  variant="navigation"
                  onPress={() =>
                    !paying &&
                    !mollieStarting &&
                    void handleMolliePay("card")
                  }
                />
                <ListSeparator />
                <ListRow
                  label={
                    payingMollie === "paypal" || mollieStarting
                      ? "PayPal wird geöffnet …"
                      : "Mit PayPal bezahlen"
                  }
                  variant="navigation"
                  onPress={() =>
                    !paying &&
                    !mollieStarting &&
                    void handleMolliePay("paypal")
                  }
                />
                <ListSeparator />
                <ListRow
                  label="In Session kassieren (Split)"
                  variant="navigation"
                  onPress={() =>
                    router.push({
                      pathname: "/session/[sessionId]",
                      params: { sessionId: order.tableSessionId },
                    })
                  }
                />
              </>
            ) : (
              <ListRow label="Vollständig bezahlt" variant="static" />
            )}
            {displayReceiptUrl ? (
              <>
                <ListSeparator />
                <ListRow
                  label="Beleg anzeigen"
                  variant="navigation"
                  onPress={() => setReceiptOpen(true)}
                />
              </>
            ) : order.paymentState === "paid" ? (
              <>
                <ListSeparator />
                <ListRow
                  label="Belege in Session"
                  variant="navigation"
                  onPress={() =>
                    router.push({
                      pathname: "/session/[sessionId]",
                      params: { sessionId: order.tableSessionId, tab: "payments" },
                    })
                  }
                />
              </>
            ) : null}
          </GroupedList>
        </GroupedSection>

        {order.fiskalyFailedAt ? (
          <Button
            label="TSE erneut signieren"
            variant="secondary"
            loading={retryingTse}
            onPress={() => void handleRetryTse()}
            style={styles.actionBtn}
          />
        ) : null}
      </ScrollView>

      {displayReceiptUrl ? (
        <ReceiptViewerModal
          visible={receiptOpen}
          url={displayReceiptUrl}
          title={`Beleg #${order.orderNumber}`}
          onClose={() => setReceiptOpen(false)}
        />
      ) : null}
      {mollieModal}
    </SafeAreaView>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.groupedBackground,
    },
    container: {
      padding: gwadaSpacing.lg,
      gap: gwadaSpacing.lg,
      paddingBottom: gwadaSpacing.xl,
    },
    actionBtn: {
      marginTop: gwadaSpacing.sm,
    },
    errorBox: {
      gap: gwadaSpacing.sm,
      padding: gwadaSpacing.lg,
      margin: gwadaSpacing.lg,
      borderRadius: gwadaRadii.card,
      backgroundColor: colors.surface,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    errorText: {
      fontSize: 14,
      color: colors.destructive,
      lineHeight: 20,
    },
  });
}
