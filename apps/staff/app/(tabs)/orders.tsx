import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { ReceiptViewerModal } from "@/src/components/ReceiptViewerModal";
import { SkeletonList } from "@/src/components/Skeleton";
import { Card, ScreenHeader } from "@/src/components/ui";
import {
  fetchActiveOrders,
  fetchPaidTodayOrders,
  type PosOrderDto,
} from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { getGwadaApiBaseUrl } from "@/src/lib/env";
import { useAuthStore } from "@/src/stores/auth-store";
import { gwadaColors, gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

type OrdersTab = "open" | "paid";

function statusLabel(order: PosOrderDto, tab: OrdersTab): string {
  if (tab === "paid") return "Bezahlt";
  if (order.paymentState === "paid") return "Bezahlt";
  return order.status;
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

        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === "open" && styles.tabActive]}
            onPress={() => setTab("open")}
          >
            <Text style={[styles.tabText, tab === "open" && styles.tabTextActive]}>
              Offen
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "paid" && styles.tabActive]}
            onPress={() => setTab("paid")}
          >
            <Text style={[styles.tabText, tab === "paid" && styles.tabTextActive]}>
              Bezahlt (heute)
            </Text>
          </Pressable>
        </View>

        {showSkeleton ? (
          <SkeletonList count={5} />
        ) : isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Verbindung zur Web-API fehlgeschlagen</Text>
            <Text style={styles.errorText}>{ordersErrorMessage(error)}</Text>
            <Text style={styles.errorHint}>
              API: {getGwadaApiBaseUrl()}
              {"\n"}
              Im Projektroot: pnpm dev (Port 3000)
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
              <Text style={styles.empty}>
                {tab === "open"
                  ? "Keine offenen Bestellungen."
                  : "Heute noch keine bezahlten Bestellungen."}
              </Text>
            }
            renderItem={({ item }) => {
              const receiptUrl = receiptUrlFor(item);
              return (
                <Card>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/order/[id]",
                        params: { id: item.id },
                      })
                    }
                  >
                    <View style={styles.row}>
                      <Text style={styles.orderNo}>#{item.orderNumber}</Text>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          {statusLabel(item, tab)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.total}>
                      {formatCentsEUR(item.totalCents)}
                    </Text>
                    {item.fiskalyFailedAt ? (
                      <Text style={styles.warn}>TSE fehlgeschlagen</Text>
                    ) : null}
                  </Pressable>
                  {tab === "paid" && receiptUrl ? (
                    <Button
                      label="Beleg anzeigen"
                      variant="secondary"
                      onPress={() =>
                        setReceiptViewer({
                          url: receiptUrl,
                          title: `Beleg #${item.orderNumber}`,
                        })
                      }
                      style={styles.receiptBtn}
                    />
                  ) : null}
                </Card>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: gwadaColors.background },
  container: { flex: 1, padding: gwadaSpacing.lg },
  tabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: gwadaSpacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: gwadaRadii.button,
    borderWidth: 1,
    borderColor: gwadaColors.border,
    backgroundColor: gwadaColors.surface,
    alignItems: "center",
  },
  tabActive: {
    borderColor: gwadaColors.accent,
    backgroundColor: gwadaColors.background,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: gwadaColors.textMuted,
  },
  tabTextActive: {
    color: gwadaColors.accent,
  },
  list: { gap: 12, paddingBottom: gwadaSpacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderNo: { fontSize: 18, fontWeight: "700", color: gwadaColors.text },
  badge: {
    backgroundColor: gwadaColors.background,
    borderRadius: gwadaRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: gwadaColors.border,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: gwadaColors.textMuted },
  total: { fontSize: 16, fontWeight: "600", color: gwadaColors.text, marginTop: 8 },
  warn: { fontSize: 13, color: gwadaColors.destructive, marginTop: 6 },
  receiptBtn: { marginTop: gwadaSpacing.sm },
  empty: { textAlign: "center", color: gwadaColors.textMuted, padding: 24 },
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
  errorHint: {
    fontSize: 13,
    color: gwadaColors.textMuted,
    lineHeight: 18,
  },
});
