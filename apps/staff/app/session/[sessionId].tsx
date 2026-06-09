import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatCentsEUR } from "@gwada/shared";
import { Button } from "@/src/components/Button";
import { ReceiptViewerModal } from "@/src/components/ReceiptViewerModal";
import {
  SessionAnimatedStatsBlock,
  SessionChromeSpacer,
  SessionFloatingChrome,
} from "@/src/components/SessionFloatingChrome";
import {
  SessionLineRow,
  createSessionOrderSectionStyles,
} from "@/src/components/SessionLineRow";
import {
  buildAllocationsFromSelection,
  computeSelectionTotalCents,
  type LineSelection,
} from "@/src/components/SessionLinePicker";
import { SessionPayBar } from "@/src/components/SessionPayBar";
import { SessionPaymentRow } from "@/src/components/SessionPaymentRow";
import { SessionSummaryCard } from "@/src/components/SessionSummaryCard";
import type { SessionTab } from "@/src/components/SessionTabBar";
import { SkeletonList } from "@/src/components/Skeleton";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import {
  closeTableSession,
  collectCashAllocations,
  fetchSessionSummary,
  type SessionSummaryLineDto,
  type SessionSummaryPaymentDto,
} from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { useAuthStore } from "@/src/stores/auth-store";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

const AnimatedOrderFlatList = Animated.createAnimatedComponent(
  FlatList<SessionListItem>,
);
const AnimatedPaymentFlatList = Animated.createAnimatedComponent(
  FlatList<SessionSummaryPaymentDto>,
);

type SessionListItem =
  | { kind: "order-header"; orderNumber: number; key: string }
  | { kind: "line"; line: SessionSummaryLineDto; key: string };

function TabEmptyState({ message }: { message: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tabEmpty}>
      <Text style={styles.tabEmptyText}>{message}</Text>
    </View>
  );
}

export default function TableSessionScreen() {
  const styles = useThemedStyles(createStyles);
  const orderSectionStyles = useThemedStyles(createSessionOrderSectionStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { sessionId, tableLabel, capacity, tab: tabParam } = useLocalSearchParams<{
    sessionId: string;
    tableLabel?: string;
    capacity?: string;
    tab?: string;
  }>();
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);

  const [tab, setTab] = useState<SessionTab>(
    tabParam === "payments" ? "payments" : "orders",
  );
  const [selection, setSelection] = useState<LineSelection>({});
  const [paying, setPaying] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [receiptViewer, setReceiptViewer] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const scrollY = useSharedValue(0);
  const contentOffsetY = useSharedValue(0);
  const statsBlockHeight = useSharedValue(0);
  const ordersListRef = useAnimatedRef<FlatList<SessionListItem>>();
  const paymentsListRef = useAnimatedRef<FlatList<SessionSummaryPaymentDto>>();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const rawY = event.contentOffset.y;
      contentOffsetY.value = rawY;
      scrollY.value = Math.max(0, rawY);
    },
  });

  const {
    data: summary,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["session-summary", restaurantId, sessionId],
    enabled: Boolean(restaurantId && sessionId),
    queryFn: async () => {
      const res = await fetchSessionSummary(restaurantId!, sessionId!);
      return res.summary;
    },
  });

  const showSkeleton = useDeferredSkeleton(isLoading);
  const label = tableLabel ?? "Tisch";
  const cap = capacity ? Number(capacity) : null;
  const selectedCents = summary
    ? computeSelectionTotalCents(summary.orders, selection)
    : 0;

  const orderListItems = useMemo<SessionListItem[]>(() => {
    if (!summary) return [];
    const items: SessionListItem[] = [];
    for (const order of summary.orders) {
      items.push({
        kind: "order-header",
        orderNumber: order.orderNumber,
        key: `order-${order.orderNumber}`,
      });
      for (const line of order.lines) {
        items.push({ kind: "line", line, key: line.id });
      }
    }
    return items;
  }, [summary]);

  const expandHeader = useCallback(() => {
    if (tab === "orders") {
      scrollTo(ordersListRef, 0, 0, true);
    } else {
      scrollTo(paymentsListRef, 0, 0, true);
    }
  }, [tab, ordersListRef, paymentsListRef]);

  useEffect(() => {
    scrollY.value = 0;
    contentOffsetY.value = 0;
    if (tab === "orders") {
      ordersListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    } else {
      paymentsListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    }
  }, [tab, scrollY, contentOffsetY, ordersListRef, paymentsListRef]);

  const setLineQty = useCallback((lineId: string, qty: number) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[lineId];
      } else {
        next[lineId] = qty;
      }
      return next;
    });
  }, []);

  const onStatsLayout = useCallback(
    (height: number) => {
      statsBlockHeight.value = height;
    },
    [statsBlockHeight],
  );

  const handlePay = async () => {
    if (!restaurantId || !sessionId || !summary) return;
    const allocations = buildAllocationsFromSelection(selection);
    if (allocations.length === 0) return;

    setPaying(true);
    try {
      await collectCashAllocations({
        restaurantId,
        tableSessionId: sessionId,
        allocations,
      });
      setSelection({});
      await refetch();
      await queryClient.invalidateQueries({
        queryKey: ["dining-floor", restaurantId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["pos-active-orders", restaurantId],
      });
      setTab("payments");
      Alert.alert("Bezahlt", "Barzahlung erfasst — Beleg unter Zahlungen.");
    } catch (err) {
      Alert.alert(
        "Zahlung fehlgeschlagen",
        posApiErrorMessage(err, "Unbekannter Fehler"),
      );
    } finally {
      setPaying(false);
    }
  };

  const handleRelease = () => {
    if (!restaurantId || !sessionId || !summary?.canReleaseTable) return;

    Alert.alert(
      "Tisch freigeben",
      summary.openLineCount === 0 && summary.orders.length === 0
        ? "Keine offenen Bestellungen. Tisch für neue Gäste freigeben?"
        : "Alle Positionen sind bezahlt. Tisch für neue Gäste freigeben?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Freigeben",
          onPress: () => {
            void (async () => {
              setReleasing(true);
              try {
                await closeTableSession(restaurantId, sessionId);
                await queryClient.invalidateQueries({
                  queryKey: ["dining-floor", restaurantId],
                });
                router.replace("/(tabs)/tables");
              } catch (err) {
                Alert.alert(
                  "Freigabe fehlgeschlagen",
                  posApiErrorMessage(err, "Unbekannter Fehler"),
                );
              } finally {
                setReleasing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleNewOrder = () => {
    router.push({
      pathname: "/order/new",
      params: { sessionId: sessionId!, tableLabel: label },
    });
  };

  const handleOpenReceipt = (payment: SessionSummaryPaymentDto) => {
    if (!payment.receiptUrl) return;
    setReceiptViewer({
      url: payment.receiptUrl,
      title: `Beleg · ${formatCentsEUR(payment.amountCents)}`,
    });
  };

  if (showSkeleton) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <SkeletonList count={4} />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.placeholder} aria-busy />
      </SafeAreaView>
    );
  }

  if (isError || !summary) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Session konnte nicht geladen werden</Text>
          <Text style={styles.errorText}>
            {posApiErrorMessage(error, "Unbekannter Fehler")}
          </Text>
          <Button label="Erneut laden" onPress={() => void refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
    />
  );

  const expandableHeader = (
    <View style={styles.expandable}>
      <SessionSummaryCard
        tableLabel={label}
        capacity={cap}
        summary={summary}
      />
      <View style={styles.actionsRow}>
        <Button
          label="Neue Bestellung"
          variant="secondary"
          onPress={handleNewOrder}
          style={styles.actionBtn}
        />
        <Button
          label="Tisch freigeben"
          onPress={handleRelease}
          loading={releasing}
          disabled={!summary.canReleaseTable}
          style={styles.actionBtn}
        />
      </View>
    </View>
  );

  const listHeader = (
    <>
      <SessionAnimatedStatsBlock
        scrollY={scrollY}
        statsBlockHeight={statsBlockHeight}
        onLayout={onStatsLayout}
      >
        {expandableHeader}
      </SessionAnimatedStatsBlock>
      <SessionChromeSpacer />
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.flex}>
        {tab === "orders" ? (
          <AnimatedOrderFlatList
            ref={ordersListRef}
            data={orderListItems}
            keyExtractor={(item) => item.key}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            bounces={Platform.OS === "ios"}
            overScrollMode="never"
            refreshControl={refreshControl}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <TabEmptyState message="Noch keine Bestellungen in dieser Session." />
            }
            renderItem={({ item }) =>
              item.kind === "order-header" ? (
                <Text style={orderSectionStyles.header}>
                  Bestellung #{item.orderNumber}
                </Text>
              ) : (
                <SessionLineRow
                  line={item.line}
                  selectedQty={selection[item.line.id] ?? 0}
                  onChangeQty={(qty) => setLineQty(item.line.id, qty)}
                />
              )
            }
          />
        ) : (
          <AnimatedPaymentFlatList
            ref={paymentsListRef}
            data={summary.payments}
            keyExtractor={(item) => item.id}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            bounces={Platform.OS === "ios"}
            overScrollMode="never"
            refreshControl={refreshControl}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <TabEmptyState message="Noch keine Zahlungen in dieser Session." />
            }
            renderItem={({ item }) => (
              <SessionPaymentRow
                payment={item}
                onOpenReceipt={handleOpenReceipt}
              />
            )}
          />
        )}

        <SessionFloatingChrome
          scrollY={scrollY}
          contentOffsetY={contentOffsetY}
          statsBlockHeight={statsBlockHeight}
          tableLabel={label}
          openCents={summary.openCents}
          openedAt={summary.openedAt}
          tab={tab}
          paymentCount={summary.payments.length}
          onTabChange={setTab}
          onExpand={expandHeader}
        />

        {tab === "orders" ? (
          <SessionPayBar
            selectedCents={selectedCents}
            paying={paying}
            onPay={() => void handlePay()}
          />
        ) : null}
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
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    expandable: {
      gap: gwadaSpacing.md,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 10,
    },
    actionBtn: { flex: 1 },
    listContent: {
      paddingHorizontal: gwadaSpacing.lg,
      paddingBottom: gwadaSpacing.lg,
      flexGrow: 1,
    },
    tabEmpty: {
      flex: 1,
      minHeight: 120,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: gwadaSpacing.xl,
    },
    tabEmptyText: {
      textAlign: "center",
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    placeholder: { flex: 1, minHeight: 120 },
    errorBox: {
      margin: gwadaSpacing.lg,
      gap: gwadaSpacing.sm,
      padding: gwadaSpacing.lg,
      borderRadius: gwadaRadii.card,
      borderWidth: 1,
      borderColor: colors.border,
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
