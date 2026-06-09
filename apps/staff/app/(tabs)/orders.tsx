import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { ReceiptViewerModal } from "@/src/components/ReceiptViewerModal";
import { SkeletonList } from "@/src/components/Skeleton";
import { ScreenHeader } from "@/src/components/ui";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { ListRow } from "@/src/components/ui/ListRow";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import {
  fetchActiveOrders,
  fetchPaidTodayOrders,
  type PosOrderDto,
} from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { orderStatusLabel, paymentStateLabel } from "@/src/lib/ui/status-labels";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { useAuthStore } from "@/src/stores/auth-store";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type OrdersTab = "open" | "paid";

const TAB_OPTIONS = [
  { id: "open" as const, label: "Offen" },
  { id: "paid" as const, label: "Bezahlt" },
];

function statusLabel(order: PosOrderDto, tab: OrdersTab): string {
  if (tab === "paid") return "Bezahlt";
  if (order.paymentState === "paid") return paymentStateLabel("paid");
  return orderStatusLabel(order.status);
}

function ordersErrorMessage(error: unknown): string {
  return posApiErrorMessage(error, "Bestellungen konnten nicht geladen werden.");
}

function receiptUrlFor(order: PosOrderDto): string | null {
  return order.receiptUrl ?? order.fiscal?.receiptPublicUrl ?? null;
}

export default function OrdersScreen() {
  const router = useRouter();
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const [tab, setTab] = useState<OrdersTab>("open");
  const [receiptViewer, setReceiptViewer] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const {
    data: openOrders,
    isLoading: openLoading,
    isError: openError,
    error: openErr,
    refetch: refetchOpen,
    isRefetching: openRefetching,
  } = useQuery({
    queryKey: ["pos-active-orders", restaurantId],
    enabled: Boolean(restaurantId) && tab === "open",
    retry: 1,
    refetchInterval: tab === "open" ? 15_000 : false,
    queryFn: async () => {
      const res = await fetchActiveOrders(restaurantId!);
      return res.orders;
    },
  });

  const {
    data: paidOrders,
    isLoading: paidLoading,
    isError: paidError,
    error: paidErr,
    refetch: refetchPaid,
    isRefetching: paidRefetching,
  } = useQuery({
    queryKey: ["pos-paid-today-orders", restaurantId],
    enabled: Boolean(restaurantId) && tab === "paid",
    retry: 1,
    refetchInterval: tab === "paid" ? 30_000 : false,
    queryFn: async () => {
      const res = await fetchPaidTodayOrders(restaurantId!);
      return res.orders;
    },
  });

  const isLoading = tab === "open" ? openLoading : paidLoading;
  const isError = tab === "open" ? openError : paidError;
  const error = tab === "open" ? openErr : paidErr;
  const data = tab === "open" ? openOrders : paidOrders;
  const refetch = tab === "open" ? refetchOpen : refetchPaid;
  const isRefetching = tab === "open" ? openRefetching : paidRefetching;

  const styles = useThemedStyles(createStyles);
  const showSkeleton = useDeferredSkeleton(isLoading);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScreenHeader
          title="Bestellungen"
          subtitle={
            tab === "open"
              ? "Offene Bestellungen im Restaurant"
              : "Heute bezahlt — Belege abrufbar"
          }
        />

        <View style={styles.segmentWrap}>
          <SegmentedControl<OrdersTab>
            options={TAB_OPTIONS}
            value={tab}
            onChange={setTab}
          />
        </View>

        {showSkeleton ? (
          <SkeletonList count={5} />
        ) : isError ? (
          <View style={styles.errorBox}>
            <Text allowFontScaling style={styles.errorTitle}>
              Verbindung fehlgeschlagen
            </Text>
            <Text allowFontScaling style={styles.errorText}>
              {ordersErrorMessage(error)}
            </Text>
            <Button label="Erneut laden" onPress={() => void refetch()} />
          </View>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.id}
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text allowFontScaling style={styles.empty}>
                {tab === "open"
                  ? "Keine offenen Bestellungen."
                  : "Heute noch keine bezahlten Bestellungen."}
              </Text>
            }
            renderItem={({ item, index }) => {
              const receiptUrl = receiptUrlFor(item);
              const label = `#${item.orderNumber}`;
              const value = `${formatCentsEUR(item.totalCents)} · ${statusLabel(item, tab)}`;

              return (
                <View style={styles.orderGroup}>
                  <GroupedList>
                    <ListRow
                      label={label}
                      value={value}
                      variant="navigation"
                      onPress={() =>
                        router.push({
                          pathname: "/order/[id]",
                          params: { id: item.id },
                        })
                      }
                    />
                    {tab === "paid" && receiptUrl ? (
                      <>
                        <ListSeparator />
                        <ListRow
                          label="Beleg anzeigen"
                          variant="navigation"
                          onPress={() =>
                            setReceiptViewer({
                              url: receiptUrl,
                              title: `Beleg #${item.orderNumber}`,
                            })
                          }
                        />
                      </>
                    ) : null}
                    {item.fiskalyFailedAt ? (
                      <>
                        <ListSeparator />
                        <ListRow
                          label="TSE"
                          value="Fehlgeschlagen"
                          variant="value"
                        />
                      </>
                    ) : null}
                  </GroupedList>
                  {index < (data?.length ?? 0) - 1 ? (
                    <View style={styles.groupSpacer} />
                  ) : null}
                </View>
              );
            }}
          />
        )}
      </View>

      {receiptViewer ? (
        <ReceiptViewerModal
          visible
          url={receiptViewer.url}
          title={receiptViewer.title}
          onClose={() => setReceiptViewer(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.groupedBackground },
    container: { flex: 1, padding: gwadaSpacing.lg },
    segmentWrap: {
      marginBottom: gwadaSpacing.md,
    },
    list: { paddingBottom: gwadaSpacing.xl },
    orderGroup: {},
    groupSpacer: { height: gwadaSpacing.sm },
    empty: { textAlign: "center", color: colors.textMuted, padding: 24 },
    errorBox: {
      gap: gwadaSpacing.sm,
      padding: gwadaSpacing.lg,
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
