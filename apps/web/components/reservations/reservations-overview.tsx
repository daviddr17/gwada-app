"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  daysInclusive,
  exclusiveUtcIsoAfterLocalVisibleEnd,
  formatDayHeadingDe,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import {
  RESERVATIONS_UNCONFIRMED_QUERY,
} from "@/lib/reservations/unconfirmed-reservations";
import {
  fetchReservationById,
  fetchReservationsForRestaurant,
  fetchUnconfirmedReservationsForRestaurant,
  type ReservationListRow,
} from "@/lib/supabase/reservations-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { reservationDiningTableLabel } from "@/lib/reservations/reservation-table-assignment";
import { usePublicHolidaysByDate } from "@/lib/hooks/use-public-holidays-by-date";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead, hasModuleCreate } from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { publicHolidayChipClassName } from "@/lib/ui/public-holiday-chip";
import { useReservationGwadaReviews } from "@/lib/hooks/use-reservation-gwada-reviews";
import type { ReservationGwadaReviewSummary } from "@/lib/reviews/reservation-gwada-review-types";
import { cn } from "@/lib/utils";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { reservationListRowButtonClassName } from "@/lib/ui/reservation-list-row-interactive";
import { DayReservationsDrawer } from "@/components/reservations/day-reservations-drawer";
import { ReservationGwadaReviewSheet } from "@/components/reservations/reservation-gwada-review-sheet";
import { ReservationGwadaReviewStarButton } from "@/components/reservations/reservation-gwada-review-star-button";
import { ReservationEditDrawer } from "@/components/reservations/reservation-edit-drawer";
import { ReservationsFilterDrawer } from "@/components/reservations/reservations-filter-drawer";
import { ReservationsOverviewPeriodStats } from "@/components/reservations/reservations-overview-period-stats";
import { ReservationsOverviewSkeleton } from "@/components/reservations/reservations-overview-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localHmFromDate(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

function useMonthCursor() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  const setMonth = (month: number) => {
    setCursor((c) => ({ year: c.year, month }));
  };

  const setYear = (year: number) => {
    setCursor((c) => ({ year, month: c.month }));
  };

  const prevMonth = () => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const nextMonth = () => {
    setCursor(({ year, month }) => {
      const d = new Date(year, month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return { cursor, setMonth, setYear, prevMonth, nextMonth };
}

export function ReservationsOverview() {
  const { cursor, setMonth, setYear, prevMonth, nextMonth } = useMonthCursor();
  const today = useMemo(() => startOfLocalDay(new Date()), []);

  const monthStart = useMemo(
    () => startOfLocalDay(new Date(cursor.year, cursor.month, 1)),
    [cursor.year, cursor.month],
  );
  const monthEnd = useMemo(
    () => startOfLocalDay(new Date(cursor.year, cursor.month + 1, 0)),
    [cursor.year, cursor.month],
  );

  const days = useMemo(
    () => daysInclusive(monthStart, monthEnd),
    [monthStart, monthEnd],
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

  const [rows, setRows] = useState<ReservationListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const {
    restaurantId: workspaceRestaurantId,
    supabaseEnvOk,
    ready: workspaceReady,
  } = useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "reservations");

  const monthFromYmd = localDayKey(monthStart);
  const monthToYmd = localDayKey(monthEnd);
  const { byDate: holidaysByDate } = usePublicHolidaysByDate(
    workspaceRestaurantId,
    monthFromYmd,
    monthToYmd,
  );

  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [daySheetDay, setDaySheetDay] = useState<Date | null>(null);
  const pendingReopenDaySheetRef = useRef<Date | null>(null);
  const [urlReservation, setUrlReservation] = useState<ReservationListRow | null>(
    null,
  );
  const [reloadNonce, setReloadNonce] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilterId, setStatusFilterId] = useState("all");
  /** Nur Auswirkung in Kombination mit aktuellem Monat + `visibleDays`. */
  const [hidePastReservations, setHidePastReservations] = useState(true);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  const [gwadaReviewSheet, setGwadaReviewSheet] = useState<{
    review: ReservationGwadaReviewSummary;
    guestLabel: string;
    reservationNumber: number | null;
  } | null>(null);

  const reservationIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const gwadaReviewsByReservation = useReservationGwadaReviews(
    workspaceRestaurantId,
    reservationIds,
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const unconfirmedMode =
    searchParams.get(RESERVATIONS_UNCONFIRMED_QUERY) === "1";
  const reservationIdParam = searchParams.get("reservation");
  const isNewParam = searchParams.get("new") === "1";
  const dayParam = searchParams.get("day");
  const createTimeParam = searchParams.get("time");
  const createTableParam = searchParams.get("table");

  useEffect(() => {
    if (!isNewParam) return;
    const t = searchParams.get("time");
    const tb = searchParams.get("table");
    let bad = false;
    const p = new URLSearchParams(searchParams.toString());
    if (t && !/^\d{2}:\d{2}$/.test(t)) {
      p.delete("time");
      bad = true;
    }
    if (tb && !isUuidRestaurantId(tb)) {
      p.delete("table");
      bad = true;
    }
    if (bad) {
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [isNewParam, searchParams, pathname, router]);

  useEffect(() => {
    const rid = searchParams.get("reservation");
    if (rid && !isUuidRestaurantId(rid)) {
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  const dbOk =
    supabaseEnvOk && workspaceReady && workspaceRestaurantId !== null;
  const showInitialLoadSkeleton = useDeferredSkeleton(
    dbOk && loading && rows.length === 0,
  );

  useEffect(() => {
    if (!reservationIdParam || !isUuidRestaurantId(reservationIdParam)) {
      setUrlReservation(null);
      return;
    }
    const inline = rows.find((r) => r.id === reservationIdParam);
    if (inline) {
      setUrlReservation(null);
      return;
    }
    if (!dbOk || !workspaceRestaurantId) {
      setUrlReservation(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await fetchReservationById({
        restaurantId: workspaceRestaurantId,
        id: reservationIdParam,
      });
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setUrlReservation(null);
        router.replace(pathname, { scroll: false });
        return;
      }
      if (!data) {
        toast.error("Reservierung nicht gefunden.");
        setUrlReservation(null);
        router.replace(pathname, { scroll: false });
        return;
      }
      setUrlReservation(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [reservationIdParam, rows, dbOk, workspaceRestaurantId, pathname, router]);

  const editReservation = useMemo((): ReservationListRow | null => {
    if (!reservationIdParam || !isUuidRestaurantId(reservationIdParam)) {
      return null;
    }
    return rows.find((r) => r.id === reservationIdParam) ?? urlReservation;
  }, [reservationIdParam, rows, urlReservation]);

  const createForDayFromUrl = useMemo(() => {
    if (!isNewParam) return null;
    if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
      const [y, m, dd] = dayParam.split("-").map(Number);
      return new Date(y, m - 1, dd);
    }
    return startOfLocalDay(new Date());
  }, [isNewParam, dayParam]);

  const createForInitialTimeHm = useMemo(() => {
    if (
      !createTimeParam ||
      !/^\d{2}:\d{2}$/.test(createTimeParam.trim())
    ) {
      return undefined;
    }
    return createTimeParam.trim();
  }, [createTimeParam]);

  const createForInitialTableId = useMemo(() => {
    if (!createTableParam || !isUuidRestaurantId(createTableParam)) {
      return undefined;
    }
    return createTableParam;
  }, [createTableParam]);

  const createFor =
    isNewParam && workspaceRestaurantId && createForDayFromUrl
      ? {
          restaurantId: workspaceRestaurantId,
          day: createForDayFromUrl,
          ...(createForInitialTimeHm
            ? { initialTimeHm: createForInitialTimeHm }
            : {}),
          ...(createForInitialTableId
            ? { initialDiningTableId: createForInitialTableId }
            : {}),
        }
      : null;

  const editOpen = Boolean(
    (reservationIdParam &&
      isUuidRestaurantId(reservationIdParam) &&
      editReservation) ||
      (isNewParam && Boolean(workspaceRestaurantId)),
  );

  const withUnconfirmedParam = useCallback(
    (p: URLSearchParams) => {
      if (unconfirmedMode) {
        p.set(RESERVATIONS_UNCONFIRMED_QUERY, "1");
      }
    },
    [unconfirmedMode],
  );

  const pushReservationEdit = useCallback(
    (id: string) => {
      const p = new URLSearchParams();
      p.set("reservation", id);
      withUnconfirmedParam(p);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [router, pathname, withUnconfirmedParam],
  );

  const pushReservationCreate = useCallback(
    (
      d: Date,
      extras?: { timeHm?: string; diningTableId?: string },
    ) => {
      const p = new URLSearchParams();
      p.set("new", "1");
      p.set("day", localDayKey(d));
      if (extras?.timeHm && /^\d{2}:\d{2}$/.test(extras.timeHm)) {
        p.set("time", extras.timeHm);
      }
      if (extras?.diningTableId && isUuidRestaurantId(extras.diningTableId)) {
        p.set("table", extras.diningTableId);
      }
      withUnconfirmedParam(p);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [router, pathname, withUnconfirmedParam],
  );

  const clearReservationUrl = useCallback(() => {
    if (unconfirmedMode) {
      const p = new URLSearchParams();
      p.set(RESERVATIONS_UNCONFIRMED_QUERY, "1");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      return;
    }
    router.replace(pathname, { scroll: false });
  }, [router, pathname, unconfirmedMode]);

  const exitUnconfirmedMode = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const setUnconfirmedMode = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        const p = new URLSearchParams(searchParams.toString());
        p.set(RESERVATIONS_UNCONFIRMED_QUERY, "1");
        p.delete("reservation");
        p.delete("new");
        p.delete("day");
        p.delete("time");
        p.delete("table");
        router.replace(`${pathname}?${p.toString()}`, { scroll: false });
        return;
      }
      const p = new URLSearchParams(searchParams.toString());
      p.delete(RESERVATIONS_UNCONFIRMED_QUERY);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const consumePendingDaySheetReopen = useCallback(() => {
    const d = pendingReopenDaySheetRef.current;
    if (!d) return;
    pendingReopenDaySheetRef.current = null;
    const copy = new Date(d.getTime());
    queueMicrotask(() => {
      setDaySheetDay(copy);
      setDaySheetOpen(true);
    });
  }, []);

  useEffect(() => {
    if (!dbOk || !workspaceRestaurantId) {
      setRows([]);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      const { data, error } = unconfirmedMode
        ? await fetchUnconfirmedReservationsForRestaurant(workspaceRestaurantId)
        : await fetchReservationsForRestaurant({
            restaurantId: workspaceRestaurantId,
            rangeStartIso,
            rangeEndExclusiveIso,
          });
      if (cancelled) return;
      setLoading(false);
      if (error) {
        setLoadError(error.message);
        setRows([]);
        return;
      }
      setRows(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    dbOk,
    workspaceRestaurantId,
    unconfirmedMode,
    rangeStartIso,
    rangeEndExclusiveIso,
    reloadNonce,
  ]);

  useEffect(() => {
    if (unconfirmedMode) {
      setStatusFilterId("all");
      setHidePastReservations(false);
    }
  }, [unconfirmedMode]);

  const statusFilterOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const s = r.reservation_statuses;
      if (s?.id && s.name) m.set(s.id, s.name);
    }
    return [...m.entries()].map(([id, name]) => ({ id, name }));
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

  const byDay = useMemo(() => {
    const map = new Map<string, ReservationListRow[]>();
    for (const r of rowsFiltered) {
      const k = dayKeyFromIso(r.starts_at);
      const arr = map.get(k);
      if (arr) arr.push(r);
      else map.set(k, [r]);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
    }
    return map;
  }, [rowsFiltered]);

  const unconfirmedDayList = useMemo(() => {
    const keys = [...byDay.keys()].sort();
    return keys.map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y!, (m ?? 1) - 1, d ?? 1);
    });
  }, [byDay]);

  const visibleDays = useMemo(() => {
    if (unconfirmedMode) {
      if (!hideEmptyDays) return unconfirmedDayList;
      return unconfirmedDayList.filter(
        (d) => (byDay.get(localDayKey(d))?.length ?? 0) > 0,
      );
    }
    let out = days;
    if (isViewingCurrentMonth && hidePastReservations) {
      out = out.filter(
        (d) => startOfLocalDay(d).getTime() >= today.getTime(),
      );
    }
    if (hideEmptyDays) {
      out = out.filter((d) => (byDay.get(localDayKey(d))?.length ?? 0) > 0);
    }
    return out;
  }, [
    unconfirmedMode,
    unconfirmedDayList,
    days,
    byDay,
    isViewingCurrentMonth,
    hidePastReservations,
    hideEmptyDays,
    today,
  ]);

  const visiblePeriodStats = useMemo(() => {
    let reservationCount = 0;
    let guestCount = 0;
    let daysWithReservations = 0;
    for (const d of visibleDays) {
      const list = byDay.get(localDayKey(d)) ?? [];
      if (list.length > 0) daysWithReservations++;
      reservationCount += list.length;
      guestCount += list.reduce((sum, r) => sum + r.party_size, 0);
    }
    return {
      reservationCount,
      guestCount,
      avgPartySize:
        reservationCount > 0 ? guestCount / reservationCount : 0,
      daysWithReservations,
      dayCount: visibleDays.length,
    };
  }, [visibleDays, byDay]);

  const filterActiveCount = useMemo(() => {
    if (unconfirmedMode) {
      let n = 1;
      if (hideEmptyDays) n++;
      return n;
    }
    let n = 0;
    if (statusFilterId !== "all") n++;
    if (isViewingCurrentMonth && !hidePastReservations) n++;
    if (hideEmptyDays) n++;
    return n;
  }, [
    unconfirmedMode,
    statusFilterId,
    isViewingCurrentMonth,
    hidePastReservations,
    hideEmptyDays,
  ]);

  const nowY = today.getFullYear();
  const yearMin = nowY - 1;
  const yearMax = nowY + 2;
  const yearItems = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: yearMax - yearMin + 1 }, (_, i) => {
          const y = yearMin + i;
          return [String(y), String(y)];
        }),
      ),
    [yearMax, yearMin],
  );

  const monthItems = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 12 }, (_, m) => [
          String(m),
          new Intl.DateTimeFormat("de-DE", { month: "long" }).format(
            new Date(2000, m, 1),
          ),
        ]),
      ),
    [],
  );

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="Reservierungen" />;
  }

  return (
    <div className="space-y-6 pb-4">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          {unconfirmedMode ? (
            <>
              <div className="order-2 min-w-0 space-y-1 sm:order-1 sm:flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Unbestätigte Reservierungen
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Offen und „Änderung prüfen“ — alle Monate, nach Termin sortiert.
                  {hideEmptyDays ? " Leere Tage ausgeblendet." : ""}
                </p>
              </div>
              <div className="order-1 flex w-full shrink-0 items-center justify-end gap-2 sm:order-2 sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl"
                  onClick={() => setFilterOpen(true)}
                >
                  <Filter className="size-4" />
                  Filter
                  {filterActiveCount > 1 ? (
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-5 rounded-full px-1 text-[10px] tabular-nums"
                    >
                      {filterActiveCount}
                    </Badge>
                  ) : null}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1 rounded-xl"
                  onClick={exitUnconfirmedMode}
                >
                  <X className="size-4" />
                  Monatsansicht
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="order-2 min-w-0 text-xs text-muted-foreground sm:order-1 sm:flex-1">
                {isViewingCurrentMonth && hidePastReservations
                  ? "Tage ab heute bis Monatsende."
                  : "Alle Tage des gewählten Monats."}
                {hideEmptyDays ? " Tage ohne Reservierungen ausgeblendet." : ""}
                {statusFilterId !== "all" ? " Nur gewählter Status." : ""}
              </p>
              <div className="order-1 flex w-full items-center justify-center gap-1 sm:order-2 sm:w-auto sm:shrink-0 sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-lg"
                  onClick={prevMonth}
                  aria-label="Vorheriger Monat"
                >
                  <ChevronLeft className="size-5" />
                </Button>
                <Select
                  value={String(cursor.month)}
                  items={monthItems}
                  onValueChange={(v) => {
                    if (typeof v === "string") setMonth(Number.parseInt(v, 10));
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className={appSelectTriggerAccentCn(
                      "h-9 min-h-9 min-w-[9.5rem] max-w-[min(100%,12rem)] shrink rounded-xl px-2.5 text-left text-sm font-normal",
                      selectValueNoShrink,
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, m) => (
                      <SelectItem key={m} value={String(m)}>
                        {monthItems[String(m)]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(cursor.year)}
                  items={yearItems}
                  onValueChange={(v) => {
                    if (typeof v === "string") setYear(Number.parseInt(v, 10));
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className={appSelectTriggerAccentCn(
                      "h-9 min-h-9 min-w-[4.75rem] w-auto shrink-0 rounded-xl px-2.5 text-left text-sm font-normal tabular-nums",
                      selectValueNoShrink,
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: yearMax - yearMin + 1 }, (_, i) => {
                      const y = yearMin + i;
                      return (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 rounded-lg"
                  onClick={nextMonth}
                  aria-label="Nächster Monat"
                >
                  <ChevronRight className="size-5" />
                </Button>
                <div className="relative shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 rounded-lg border-border/60"
                    aria-label="Filter"
                    onClick={() => setFilterOpen(true)}
                  >
                    <Filter className="size-4" />
                  </Button>
                  {filterActiveCount > 0 ? (
                    <Badge
                      variant="secondary"
                      className="pointer-events-none absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums"
                    >
                      {filterActiveCount}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </CardHeader>
      </Card>

      {!supabaseEnvOk ? (
        <p className="text-center text-sm text-muted-foreground">
          Es fehlen{" "}
          <span className="font-mono text-foreground/80">
            NEXT_PUBLIC_SUPABASE_URL
          </span>{" "}
          und{" "}
          <span className="font-mono text-foreground/80">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </span>{" "}
          (z.&nbsp;B. in{" "}
          <span className="font-mono text-foreground/80">.env.local</span>).
        </p>
      ) : workspaceReady && !workspaceRestaurantId ? (
        <p className="text-center text-sm text-muted-foreground">
          Es ist kein aktives Workspace-Restaurant gesetzt oder dein Konto ist
          keiner UUID-Restaurant-Zuordnung zugeordnet. Bitte unter{" "}
          <Link
            href="/workspace/restaurants"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Workspace → Restaurants
          </Link>{" "}
          ein Restaurant wählen und sicherstellen, dass du angemeldet bist.
        </p>
      ) : loadError ? (
        <p className="text-center text-sm text-destructive">{loadError}</p>
      ) : null}

      {dbOk && showInitialLoadSkeleton ? <ReservationsOverviewSkeleton /> : null}

      {dbOk && !loading && visibleDays.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground">
          {unconfirmedMode
            ? "Keine unbestätigten Reservierungen — alles erledigt."
            : hideEmptyDays
              ? "Keine Tage mit Reservierungen im gewählten Zeitraum."
              : "Keine Reservierungen in diesem Monat."}
        </p>
      ) : null}

      {dbOk && !loading && visibleDays.length > 0 ? (
        <ReservationsOverviewPeriodStats
          className="mb-4"
          {...visiblePeriodStats}
        />
      ) : null}

      {dbOk && !unconfirmedMode ? (
        <div className="mb-4">
          <Button
            type="button"
            size="lg"
            className={modulePrimaryAddButtonFullWidthClassName}
            onClick={() => pushReservationCreate(today)}
          >
            <Plus className="size-4" />
            Neue Reservierung
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {visibleDays.map((d) => {
          const isToday = d.getTime() === today.getTime();
          const key = localDayKey(d);
          const holidayName = holidaysByDate[key];
          const list = byDay.get(key) ?? [];
          const resCount = list.length;
          const partyTotal = list.reduce((sum, r) => sum + r.party_size, 0);
          return (
            <Card
              key={key}
              size="sm"
              className={cn(
                "gap-2 border-border/50 py-2 shadow-card transition-colors",
                isToday && "ring-1 ring-green-500/25 dark:ring-green-400/20",
              )}
            >
              <CardHeader className="gap-1.5 pb-1 pt-2">
                {isToday ? (
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                    Heute
                  </p>
                ) : null}
                <div className="flex items-start justify-between gap-3 sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base font-semibold sm:text-lg">
                        {formatDayHeadingDe(d)}
                      </CardTitle>
                      {holidayName ? (
                        <Badge
                          variant="outline"
                          className={publicHolidayChipClassName}
                        >
                          {holidayName}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      {resCount === 1
                        ? "1 Reservierung"
                        : `${resCount} Reservierungen`}
                      {" · "}
                      {partyTotal === 1
                        ? "1 Person"
                        : `${partyTotal} Personen`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg text-muted-foreground hover:text-foreground"
                      aria-label="Neue Reservierung"
                      onClick={() => {
                        pushReservationCreate(d);
                      }}
                    >
                      <Plus className="size-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-lg text-muted-foreground hover:text-foreground"
                      aria-label="Tagesübersicht"
                      onClick={() => {
                        setDaySheetDay(d);
                        setDaySheetOpen(true);
                      }}
                    >
                      <CalendarDays className="size-5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {list.length > 0 ? (
                <>
                  <Separator className="mx-6" />
                  <CardContent className="space-y-1.5 py-2">
                    {list.map((r) => {
                      const st = r.reservation_statuses;
                      const stripe =
                        st?.color_hex && /^#[0-9A-Fa-f]{6}$/i.test(st.color_hex)
                          ? st.color_hex
                          : "#64748b";
                      const guest =
                        `${r.guest_first_name} ${r.guest_last_name}`.trim();
                      const timeLabel = timeDe.format(new Date(r.starts_at));
                      const endLabel = timeDe.format(new Date(r.ends_at));
                      const tableLabel = reservationDiningTableLabel(r);
                      const gwadaReview = gwadaReviewsByReservation.get(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={cn(
                            "flex gap-3",
                            reservationListRowButtonClassName,
                          )}
                          aria-label={`Reservierung ${guest} bearbeiten`}
                          onClick={() => {
                            pushReservationEdit(r.id);
                          }}
                        >
                          <div
                            className="mt-0.5 w-0.5 shrink-0 self-stretch rounded-full sm:mt-0"
                            style={{ backgroundColor: stripe }}
                            aria-hidden
                          />
                          <div
                            className={cn(
                              "grid min-w-0 flex-1 items-center gap-x-3 gap-y-0.5",
                              gwadaReview
                                ? "grid-cols-[auto_1fr_auto] grid-rows-2"
                                : "grid-cols-[auto_1fr] grid-rows-2",
                            )}
                          >
                            <div className="row-span-2 flex items-center self-stretch pr-0.5">
                              <span className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground sm:text-4xl">
                                {timeLabel}
                              </span>
                            </div>
                            <div className="col-start-2 row-start-1 min-w-0">
                              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="font-medium">{guest}</span>
                                <span className="text-xs text-muted-foreground">
                                  {st?.name ?? "—"}
                                </span>
                                {st?.code === "change_requested" ? (
                                  <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:text-amber-200">
                                    Änderung prüfen
                                  </span>
                                ) : null}
                                {tableLabel ? (
                                  <span className="rounded-md border border-border/50 bg-background/80 px-1.5 py-px text-[11px] font-medium text-foreground">
                                    {tableLabel}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="col-start-2 row-start-2 min-w-0">
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:text-sm">
                                <span>
                                  {r.party_size}{" "}
                                  {r.party_size === 1 ? "Person" : "Personen"}
                                </span>
                                <span className="tabular-nums">
                                  bis {endLabel}
                                </span>
                                {r.guest_phone ? (
                                  <span className="truncate">{r.guest_phone}</span>
                                ) : null}
                                {r.guest_email ? (
                                  <span className="min-w-0 truncate">
                                    {r.guest_email}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {gwadaReview ? (
                              <ReservationGwadaReviewStarButton
                                review={gwadaReview}
                                className="col-start-3 row-span-2 self-center justify-self-end"
                                onOpen={() => {
                                  setGwadaReviewSheet({
                                    review: gwadaReview,
                                    guestLabel: guest,
                                    reservationNumber: r.reservation_number,
                                  });
                                }}
                              />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </CardContent>
                </>
              ) : null}
            </Card>
          );
        })}
      </div>

      <ReservationsFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        unconfirmedMode={unconfirmedMode}
        statusOptions={statusFilterOptions}
        statusFilterId={statusFilterId}
        onStatusFilterIdChange={setStatusFilterId}
        showHidePastSection={!unconfirmedMode && isViewingCurrentMonth}
        hidePastReservations={hidePastReservations}
        onHidePastReservationsChange={setHidePastReservations}
        hideEmptyDays={hideEmptyDays}
        onHideEmptyDaysChange={setHideEmptyDays}
        onUnconfirmedModeChange={setUnconfirmedMode}
      />

      <DayReservationsDrawer
        open={daySheetOpen}
        onOpenChange={setDaySheetOpen}
        day={daySheetDay}
        restaurantId={workspaceRestaurantId}
        reservations={
          daySheetDay ? (byDay.get(localDayKey(daySheetDay)) ?? []) : []
        }
        onEdit={(r) => {
          if (daySheetDay) {
            pendingReopenDaySheetRef.current = new Date(daySheetDay.getTime());
          }
          setDaySheetOpen(false);
          pushReservationEdit(r.id);
        }}
        onCreateReservation={
          daySheetDay && workspaceRestaurantId
            ? (detail) => {
                pendingReopenDaySheetRef.current = new Date(
                  daySheetDay.getTime(),
                );
                setDaySheetOpen(false);
                if (detail?.startsAt && detail.diningTableId) {
                  pushReservationCreate(daySheetDay, {
                    timeHm: localHmFromDate(detail.startsAt),
                    diningTableId: detail.diningTableId,
                  });
                } else {
                  pushReservationCreate(daySheetDay);
                }
              }
            : undefined
        }
        onDataChanged={() => setReloadNonce((n) => n + 1)}
      />

      <ReservationEditDrawer
        open={editOpen}
        onOpenChange={(o) => {
          if (!o) {
            clearReservationUrl();
            consumePendingDaySheetReopen();
          }
        }}
        reservation={editReservation}
        createFor={createFor}
        overlapReservations={rows}
        onSaved={() => {
          setReloadNonce((n) => n + 1);
          clearReservationUrl();
          consumePendingDaySheetReopen();
        }}
      />

      <ReservationGwadaReviewSheet
        open={gwadaReviewSheet !== null}
        onOpenChange={(o) => {
          if (!o) setGwadaReviewSheet(null);
        }}
        review={gwadaReviewSheet?.review ?? null}
        guestLabel={gwadaReviewSheet?.guestLabel ?? ""}
        reservationNumber={gwadaReviewSheet?.reservationNumber ?? null}
      />
    </div>
  );
}
