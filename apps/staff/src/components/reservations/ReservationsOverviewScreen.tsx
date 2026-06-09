import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayKey,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@gwada/shared";
import { ReservationDetailSheet } from "@/src/components/ReservationDetailSheet";
import { ReservationOverviewRow } from "@/src/components/reservations/ReservationOverviewRow";
import { ReservationsDayHeader } from "@/src/components/reservations/ReservationsDayHeader";
import { ReservationsFilterSheet } from "@/src/components/reservations/ReservationsFilterSheet";
import { ReservationsMonthToolbar } from "@/src/components/reservations/ReservationsMonthToolbar";
import { SkeletonList } from "@/src/components/Skeleton";
import { ScreenHeader } from "@/src/components/ui";
import { GroupedList } from "@/src/components/ui/GroupedList";
import { ListSeparator } from "@/src/components/ui/ListSeparator";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { useDeferredSkeleton } from "@/src/lib/hooks/use-deferred-skeleton";
import { useReservationsLive } from "@/src/lib/hooks/use-reservations-live";
import { fetchPublicHolidaysByDate } from "@/src/lib/reservations/holidays-api";
import {
  buildMonthDays,
  computeVisibleDays,
  countFilterActive,
  groupReservationsByDay,
  unconfirmedDayList as buildUnconfirmedDayList,
} from "@/src/lib/reservations/overview-logic";
import {
  fetchReservationsForMonth,
  fetchUnconfirmedReservations,
  type ReservationListRow,
} from "@/src/lib/reservations/reservations-db";
import { useAuthStore } from "@/src/stores/auth-store";
import { useStaffTheme } from "@/src/theme/staff-theme";
import { useThemedStyles } from "@/src/theme/use-themed-styles";
import type { GwadaColors } from "@/src/theme/tokens";
import { gwadaSpacing } from "@/src/theme/tokens";

type OverviewMode = "month" | "unconfirmed";

type DayListItem = {
  key: string;
  day: Date;
  reservations: ReservationListRow[];
};

const MODE_OPTIONS = [
  { id: "month" as const, label: "Monat" },
  { id: "unconfirmed" as const, label: "Unbestätigt" },
];

function useMonthCursor() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  return {
    cursor,
    setMonth: (month: number) => setCursor((c) => ({ ...c, month })),
    setYear: (year: number) => setCursor((c) => ({ ...c, year })),
    prevMonth: () =>
      setCursor(({ year, month }) => {
        const d = new Date(year, month - 1, 1);
        return { year: d.getFullYear(), month: d.getMonth() };
      }),
    nextMonth: () =>
      setCursor(({ year, month }) => {
        const d = new Date(year, month + 1, 1);
        return { year: d.getFullYear(), month: d.getMonth() };
      }),
  };
}

export function ReservationsOverviewScreen() {
  const styles = useThemedStyles(createStyles);
  const restaurantId = useAuthStore((s) => s.activeRestaurantId);
  const { cursor, setMonth, setYear, prevMonth, nextMonth } = useMonthCursor();
  const today = useMemo(() => startOfLocalDay(new Date()), []);

  const [mode, setMode] = useState<OverviewMode>("month");
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilterId, setStatusFilterId] = useState("all");
  const [hidePastReservations, setHidePastReservations] = useState(true);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  const [detail, setDetail] = useState<ReservationListRow | null>(null);

  const monthStart = useMemo(
    () => startOfLocalDay(new Date(cursor.year, cursor.month, 1)),
    [cursor.year, cursor.month],
  );
  const monthEnd = useMemo(
    () => startOfLocalDay(new Date(cursor.year, cursor.month + 1, 0)),
    [cursor.year, cursor.month],
  );
  const days = useMemo(
    () => buildMonthDays(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );
  const rangeStartIso = useMemo(
    () => localDayStartToUtcIso(monthStart),
    [monthStart],
  );
  const rangeEndExclusiveIso = useMemo(
    () => exclusiveUtcIsoAfterLocalVisibleEnd(monthEnd),
    [monthEnd],
  );
  const isViewingCurrentMonth =
    cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  const { refetchInterval } = useReservationsLive(restaurantId);

  const {
    data: rows = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: [
      "reservations-overview",
      restaurantId,
      mode,
      mode === "month" ? rangeStartIso : "unconfirmed",
      mode === "month" ? rangeEndExclusiveIso : null,
    ],
    enabled: Boolean(restaurantId),
    refetchInterval,
    queryFn: async () => {
      if (!restaurantId) return [];
      if (mode === "unconfirmed") {
        return fetchUnconfirmedReservations(restaurantId);
      }
      return fetchReservationsForMonth({
        restaurantId,
        rangeStartIso,
        rangeEndExclusiveIso,
      });
    },
  });

  const monthFromYmd = localDayKey(monthStart);
  const monthToYmd = localDayKey(monthEnd);

  const { data: holidaysByDate = {} } = useQuery({
    queryKey: ["reservations-holidays", restaurantId, monthFromYmd, monthToYmd],
    enabled: Boolean(restaurantId) && mode === "month",
    queryFn: () =>
      fetchPublicHolidaysByDate(restaurantId!, monthFromYmd, monthToYmd),
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (mode === "unconfirmed") {
      setStatusFilterId("all");
      setHidePastReservations(false);
    }
  }, [mode]);

  const statusFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      const st = row.reservation_statuses;
      if (st?.id && st.name) map.set(st.id, st.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  useEffect(() => {
    if (
      statusFilterId !== "all" &&
      !statusFilterOptions.some((o) => o.id === statusFilterId)
    ) {
      setStatusFilterId("all");
    }
  }, [statusFilterId, statusFilterOptions]);

  const rowsFiltered = useMemo(() => {
    if (statusFilterId === "all") return rows;
    return rows.filter((r) => r.reservation_statuses?.id === statusFilterId);
  }, [rows, statusFilterId]);

  const byDay = useMemo(
    () => groupReservationsByDay(rowsFiltered),
    [rowsFiltered],
  );

  const unconfirmedDays = useMemo(
    () => buildUnconfirmedDayList(byDay),
    [byDay],
  );

  const visibleDays = useMemo(
    () =>
      computeVisibleDays({
        unconfirmedMode: mode === "unconfirmed",
        days,
        byDay,
        unconfirmedDayList: unconfirmedDays,
        isViewingCurrentMonth,
        hidePastReservations,
        hideEmptyDays,
        today,
      }),
    [
      mode,
      days,
      byDay,
      unconfirmedDays,
      isViewingCurrentMonth,
      hidePastReservations,
      hideEmptyDays,
      today,
    ],
  );

  const filterActiveCount = useMemo(
    () =>
      countFilterActive({
        unconfirmedMode: mode === "unconfirmed",
        statusFilterId,
        isViewingCurrentMonth,
        hidePastReservations,
        hideEmptyDays,
      }),
    [
      mode,
      statusFilterId,
      isViewingCurrentMonth,
      hidePastReservations,
      hideEmptyDays,
    ],
  );

  const dayItems = useMemo((): DayListItem[] => {
    return visibleDays.map((day) => {
      const key = localDayKey(day);
      return {
        key,
        day,
        reservations: byDay.get(key) ?? [],
      };
    });
  }, [visibleDays, byDay]);

  const showSkeleton = useDeferredSkeleton(isLoading && rows.length === 0);

  const resetFilters = useCallback(() => {
    setMode("month");
    setStatusFilterId("all");
    setHidePastReservations(true);
    setHideEmptyDays(false);
  }, []);

  const contextHint =
    mode === "unconfirmed"
      ? `Offen und „Änderung prüfen“ — alle Monate.${hideEmptyDays ? " Leere Tage ausgeblendet." : ""}`
      : `${isViewingCurrentMonth && hidePastReservations ? "Tage ab heute bis Monatsende." : "Alle Tage des gewählten Monats."}${hideEmptyDays ? " Tage ohne Reservierungen ausgeblendet." : ""}${statusFilterId !== "all" ? " Nur gewählter Status." : ""}`;

  if (!restaurantId) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.container}>
          <ScreenHeader title="Reservierungen" />
          <Text style={styles.muted}>Kein Restaurant ausgewählt.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <ScreenHeader title="Reservierungen" />
          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
          {mode === "month" ? (
            <ReservationsMonthToolbar
              year={cursor.year}
              month={cursor.month}
              filterActiveCount={filterActiveCount}
              onPrevMonth={prevMonth}
              onNextMonth={nextMonth}
              onMonthChange={setMonth}
              onYearChange={setYear}
              onOpenFilter={() => setFilterOpen(true)}
            />
          ) : (
            <View style={styles.unconfirmedToolbar}>
              <Text allowFontScaling style={styles.unconfirmedTitle}>
                Unbestätigte Reservierungen
              </Text>
              <PressableFilterButton
                filterActiveCount={filterActiveCount}
                onOpenFilter={() => setFilterOpen(true)}
              />
            </View>
          )}
          <Text allowFontScaling style={styles.hint}>
            {contextHint}
          </Text>
        </View>

        {showSkeleton ? (
          <View style={styles.listBody}>
            <SkeletonList count={6} />
          </View>
        ) : isError ? (
          <View style={styles.emptyBox}>
            <Text style={styles.error}>
              {error instanceof Error
                ? error.message
                : "Reservierungen konnten nicht geladen werden."}
            </Text>
          </View>
        ) : (
          <FlatList
            data={dayItems}
            keyExtractor={(item) => item.key}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
              />
            }
            contentContainerStyle={
              dayItems.length === 0 ? styles.listEmpty : styles.listContent
            }
            ItemSeparatorComponent={() => <View style={styles.sectionGap} />}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.empty}>
                    {mode === "unconfirmed"
                      ? "Keine unbestätigten Reservierungen — alles erledigt."
                      : hideEmptyDays
                        ? "Keine Tage mit Reservierungen im gewählten Zeitraum."
                        : "Keine Reservierungen in diesem Monat."}
                  </Text>
                </View>
              ) : (
                <View style={styles.listPlaceholder} aria-busy />
              )
            }
            renderItem={({ item }) => {
              const partyTotal = item.reservations.reduce(
                (s, r) => s + r.party_size,
                0,
              );
              const isToday =
                item.day.getTime() === startOfLocalDay(today).getTime();
              return (
                <GroupedList style={styles.sectionCard}>
                  <ReservationsDayHeader
                    day={item.day}
                    reservationCount={item.reservations.length}
                    partyTotal={partyTotal}
                    isToday={isToday}
                    holidayName={holidaysByDate[item.key] ?? null}
                  />
                  {item.reservations.length === 0 ? (
                    <Text allowFontScaling style={styles.emptyDay}>
                      Keine Reservierungen an diesem Tag.
                    </Text>
                  ) : (
                    item.reservations.map((row, index) => (
                      <View key={row.id}>
                        {index > 0 ? <ListSeparator /> : null}
                        <ReservationOverviewRow
                          reservation={row}
                          onPress={() => setDetail(row)}
                        />
                      </View>
                    ))
                  )}
                </GroupedList>
              );
            }}
          />
        )}
      </View>

      <ReservationsFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        unconfirmedMode={mode === "unconfirmed"}
        statusFilterId={statusFilterId}
        statusOptions={statusFilterOptions}
        hidePastReservations={hidePastReservations}
        hideEmptyDays={hideEmptyDays}
        showHidePast={isViewingCurrentMonth}
        onStatusFilterIdChange={setStatusFilterId}
        onHidePastChange={setHidePastReservations}
        onHideEmptyDaysChange={setHideEmptyDays}
        onUnconfirmedModeChange={(enabled) =>
          setMode(enabled ? "unconfirmed" : "month")
        }
        onReset={resetFilters}
      />

      <ReservationDetailSheet
        visible={detail != null}
        reservation={detail}
        onClose={() => setDetail(null)}
      />
    </SafeAreaView>
  );
}

function PressableFilterButton({
  filterActiveCount,
  onOpenFilter,
}: {
  filterActiveCount: number;
  onOpenFilter: () => void;
}) {
  const styles = useThemedStyles(createFilterStyles);
  const { colors } = useStaffTheme();

  return (
    <View style={styles.filterWrap}>
      <Pressable
        onPress={onOpenFilter}
        style={styles.filterBtn}
        accessibilityLabel="Filter"
      >
        <Ionicons name="filter" size={20} color={colors.text} />
      </Pressable>
      {filterActiveCount > 0 ? (
        <View style={styles.badge}>
          <Text allowFontScaling style={styles.badgeText}>
            {filterActiveCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function createFilterStyles(colors: GwadaColors) {
  return StyleSheet.create({
    filterWrap: {
      position: "relative",
    },
    filterBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    badge: {
      position: "absolute",
      top: -2,
      right: -2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      backgroundColor: colors.accent,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.accentForeground,
    },
  });
}

function createStyles(colors: GwadaColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.groupedBackground },
    flex: { flex: 1 },
    container: {
      flex: 1,
      paddingHorizontal: gwadaSpacing.lg,
      gap: gwadaSpacing.md,
    },
    header: {
      paddingHorizontal: gwadaSpacing.lg,
      paddingTop: gwadaSpacing.lg,
      gap: gwadaSpacing.md,
    },
    unconfirmedToolbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: gwadaSpacing.md,
    },
    unconfirmedTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    hint: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 18,
    },
    listBody: {
      flex: 1,
      paddingHorizontal: gwadaSpacing.lg,
    },
    listContent: {
      paddingBottom: gwadaSpacing.xl,
    },
    listEmpty: {
      flexGrow: 1,
    },
    listPlaceholder: {
      flex: 1,
      minHeight: 120,
    },
    sectionCard: {
      marginHorizontal: gwadaSpacing.lg,
    },
    sectionGap: {
      height: gwadaSpacing.sm,
    },
    emptyDay: {
      fontSize: 14,
      color: colors.textMuted,
      paddingHorizontal: gwadaSpacing.md,
      paddingBottom: gwadaSpacing.md,
    },
    emptyBox: {
      padding: gwadaSpacing.xl,
      alignItems: "center",
    },
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    error: {
      textAlign: "center",
      color: colors.destructive,
      fontSize: 15,
    },
    muted: {
      color: colors.textMuted,
      fontSize: 15,
    },
  });
}
