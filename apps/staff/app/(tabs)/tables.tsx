import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CoverCountSheet } from "@/src/components/CoverCountSheet";
import { DiningAreaFilter } from "@/src/components/DiningAreaFilter";
import { RegisterOpenSheet } from "@/src/components/RegisterOpenSheet";
import { ReservationDetailSheet } from "@/src/components/ReservationDetailSheet";
import { SkeletonList } from "@/src/components/Skeleton";
import { TableOccupiedMeta } from "@/src/components/TableOccupiedMeta";
import { TableReservationMeta } from "@/src/components/TableReservationMeta";
import { Card, ScreenHeader } from "@/src/components/ui";
import {
  type DiningTableRow,
  type OpenTableSessionRow,
  type TableReservationRow,
  fetchDiningFloorSnapshot,
  formatDiningTableLabel,
} from "@/src/lib/dining-floor";
import { useDiningFloorLive } from "@/src/lib/hooks/use-dining-floor-live";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { useStaffPermissions } from "@/src/lib/hooks/use-staff-permissions";
import { fetchRegisterStatus, openTableSession } from "@/src/lib/pos-api";
import { posApiErrorMessage } from "@/src/lib/pos-error-message";
import { useAuthStore } from "@/src/stores/auth-store";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaRadii, gwadaSpacing } from "@/src/theme/tokens";

export default function TablesScreen() {
  const router = useRouter();
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const { has, loading: permsLoading } = useStaffPermissions();
  const canManageKasse = has("pos.kasse.manage");

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [pendingTable, setPendingTable] = useState<DiningTableRow | null>(null);
  const [coverCount, setCoverCount] = useState(2);
  const [registerSheetVisible, setRegisterSheetVisible] = useState(false);
  const [coverSheetVisible, setCoverSheetVisible] = useState(false);
  const [pendingOpeningCashCents, setPendingOpeningCashCents] = useState<
    number | null
  >(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [detailReservation, setDetailReservation] =
    useState<TableReservationRow | null>(null);

  const { refetchInterval } = useDiningFloorLive(restaurantId);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["dining-floor", restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: () => fetchDiningFloorSnapshot(restaurantId!),
    refetchInterval,
  });

  const { data: registerStatus } = useQuery({
    queryKey: ["register-status", restaurantId],
    enabled: Boolean(restaurantId),
    queryFn: () => fetchRegisterStatus(restaurantId!),
  });

  useEffect(() => {
    if (!data?.areas.length || selectedAreaId) return;
    setSelectedAreaId(data.areas[0]!.id);
  }, [data?.areas, selectedAreaId]);

  const sessionByTableId = useMemo(() => {
    const map = new Map<string, OpenTableSessionRow>();
    for (const s of data?.openSessions ?? []) {
      map.set(s.dining_table_id, s);
    }
    return map;
  }, [data?.openSessions]);

  const filteredTables = useMemo(() => {
    if (!data?.tables.length || !selectedAreaId) return data?.tables ?? [];
    return data.tables.filter((t) => t.area_id === selectedAreaId);
  }, [data?.tables, selectedAreaId]);

  const resetFlow = useCallback(() => {
    setPendingTable(null);
    setRegisterSheetVisible(false);
    setCoverSheetVisible(false);
    setPendingOpeningCashCents(null);
    setCoverCount(2);
  }, []);

  const startSession = useCallback(
    async (table: DiningTableRow, count: number, openingCashCents?: number) => {
      if (!restaurantId) return;
      setSessionBusy(true);
      try {
        const { sessionId } = await openTableSession({
          restaurantId,
          diningTableId: table.id,
          coverCount: count,
          openingCashCents,
        });
        const label = formatDiningTableLabel(table);
        resetFlow();
        router.push({
          pathname: "/order/new",
          params: { sessionId, tableLabel: label },
        });
      } catch (err) {
        Alert.alert(
          "Tisch öffnen fehlgeschlagen",
          posApiErrorMessage(err, "Tisch-Session konnte nicht geöffnet werden."),
        );
      } finally {
        setSessionBusy(false);
      }
    },
    [restaurantId, resetFlow, router],
  );

  const handleTablePress = useCallback(
    (table: DiningTableRow) => {
      const openSession = sessionByTableId.get(table.id);
      if (openSession) {
        router.push({
          pathname: "/session/[sessionId]",
          params: {
            sessionId: openSession.id,
            tableLabel: formatDiningTableLabel(table),
            capacity: String(table.capacity),
          },
        });
        return;
      }

      if (!registerStatus?.isOpen) {
        if (!canManageKasse) {
          Alert.alert(
            "Kasse geschlossen",
            "Die Kasse ist geschlossen. Bitte zuerst in der Kasse öffnen, bevor du eine Bestellung aufnehmen kannst.",
          );
          return;
        }
        setPendingTable(table);
        setCoverCount(Math.min(2, table.capacity));
        setRegisterSheetVisible(true);
        return;
      }

      setPendingTable(table);
      setCoverCount(Math.min(2, table.capacity));
      setCoverSheetVisible(true);
    },
    [sessionByTableId, registerStatus?.isOpen, canManageKasse, router],
  );

  const handleRegisterConfirm = (openingCashCents: number) => {
    setPendingOpeningCashCents(openingCashCents);
    setRegisterSheetVisible(false);
    setCoverSheetVisible(true);
  };

  const handleCoverConfirm = () => {
    if (!pendingTable) return;
    void startSession(
      pendingTable,
      coverCount,
      pendingOpeningCashCents ?? undefined,
    );
  };

  const styles = useThemedStyles(createStyles);
  const showSkeleton = useDeferredSkeleton(isLoading || permsLoading);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <ScreenHeader
            title="Tische"
            subtitle="Bereich wählen, Tisch antippen und Bestellung starten"
          />
          {!showSkeleton && !isLoading ? (
            <DiningAreaFilter
              areas={data?.areas ?? []}
              activeAreaId={selectedAreaId}
              onAreaSelect={setSelectedAreaId}
            />
          ) : null}
        </View>

        {showSkeleton ? (
          <View style={styles.listBody}>
            <SkeletonList count={6} />
          </View>
        ) : isLoading ? (
          <View style={styles.listBody}>
            <View style={styles.listPlaceholder} aria-busy />
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={filteredTables}
            keyExtractor={(item) => item.id}
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            contentContainerStyle={[
              styles.listContent,
              filteredTables.length === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.empty}>
                  {data?.areas.length
                    ? "Keine Tische in diesem Bereich."
                    : "Keine aktiven Tische."}
                </Text>
                <Text style={styles.emptyHint}>
                  Tische im Web unter Reservierungen → Tischplan anlegen, oder
                  lokal:{"\n"}pnpm db:seed:dining-floor
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const openSession = sessionByTableId.get(item.id);
              const sessionMeta = openSession
                ? data?.sessionMetaBySessionId[openSession.id]
                : undefined;
              const reservationSlots =
                data?.reservationsByTableId[item.id] ?? null;
              const currentReservations = reservationSlots?.current ?? [];
              const nextReservation = reservationSlots?.next ?? null;
              const hasActiveReservation = currentReservations.length > 0;
              const showReservedChip =
                !openSession && hasActiveReservation;
              const reservedPartySize =
                currentReservations[0]?.party_size ?? 0;

              return (
                <Card onPress={() => handleTablePress(item)}>
                  <View style={styles.cardRow}>
                    <View style={styles.cardMain}>
                      <Text style={styles.tableName}>
                        {formatDiningTableLabel(item)}
                      </Text>
                      <Text style={styles.tableMeta}>
                        Nr. {item.table_number} · {item.capacity} Plätze
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusChip,
                        openSession
                          ? styles.statusOccupied
                          : showReservedChip
                            ? styles.statusReserved
                            : styles.statusFree,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          openSession
                            ? styles.statusTextOccupied
                            : showReservedChip
                              ? styles.statusTextReserved
                              : styles.statusTextFree,
                        ]}
                      >
                        {openSession
                          ? `Besetzt · ${openSession.cover_count} Pers.`
                          : showReservedChip
                            ? `Reserviert · ${reservedPartySize} Pers.`
                            : "Frei"}
                      </Text>
                    </View>
                  </View>
                  {openSession ? (
                    <TableOccupiedMeta
                      openedAt={openSession.opened_at}
                      meta={sessionMeta}
                    />
                  ) : null}
                  {currentReservations.length > 0 || nextReservation ? (
                    <TableReservationMeta
                      current={currentReservations}
                      next={nextReservation}
                      onPressReservation={setDetailReservation}
                    />
                  ) : null}
                </Card>
              );
            }}
          />
        )}
      </View>

      <RegisterOpenSheet
        visible={registerSheetVisible}
        suggestedOpeningCashCents={
          registerStatus?.suggestedOpeningCashCents ?? null
        }
        onConfirm={handleRegisterConfirm}
        onClose={resetFlow}
        loading={sessionBusy}
      />

      <CoverCountSheet
        visible={coverSheetVisible}
        tableLabel={
          pendingTable ? formatDiningTableLabel(pendingTable) : ""
        }
        capacity={pendingTable?.capacity ?? 1}
        coverCount={coverCount}
        onChangeCount={setCoverCount}
        onConfirm={handleCoverConfirm}
        onClose={resetFlow}
        loading={sessionBusy}
      />

      <ReservationDetailSheet
        visible={detailReservation != null}
        reservation={detailReservation}
        onClose={() => setDetailReservation(null)}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      paddingHorizontal: gwadaSpacing.lg,
      paddingTop: gwadaSpacing.lg,
      gap: gwadaSpacing.md,
    },
    listBody: {
      flex: 1,
      paddingHorizontal: gwadaSpacing.lg,
    },
    list: { flex: 1 },
    listContent: {
      paddingHorizontal: gwadaSpacing.lg,
      paddingBottom: gwadaSpacing.xl,
      gap: 12,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    listPlaceholder: { flex: 1, minHeight: 200 },
    cardRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    cardMain: { flex: 1, gap: 4 },
    tableName: { fontSize: 18, fontWeight: "600", color: colors.text },
    tableMeta: { fontSize: 14, color: colors.textMuted },
    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: gwadaRadii.pill,
    },
    statusFree: {
      backgroundColor: colors.successMuted,
    },
    statusOccupied: {
      backgroundColor: colors.occupiedMuted,
    },
    statusReserved: {
      backgroundColor: colors.warningMuted,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
    },
    statusTextFree: {
      color: colors.success,
    },
    statusTextOccupied: {
      color: colors.occupied,
    },
    statusTextReserved: {
      color: colors.warning,
    },
    emptyBox: { padding: 24, gap: 8 },
    empty: { textAlign: "center", color: colors.text, fontWeight: "600" },
    emptyHint: {
      textAlign: "center",
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
