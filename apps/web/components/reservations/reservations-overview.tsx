"use client";

import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  type ReservationListRow,
} from "@/lib/supabase/reservations-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  reservationAssignedTableLabel,
  reservationDiningTableLabel,
} from "@/lib/reservations/reservation-table-assignment";
import { formatReservationQuotationJoinLabel } from "@/lib/reservations/reservation-quotation-label";
import {
  isRelocatedMarkerRow,
  liveReservationIdFromListRowId,
  relocatedMarkerListRowFromReservation,
  reservationCountsTowardDayStats,
  RESERVATION_MOVED_STATUS_CODE,
} from "@/lib/reservations/reservation-relocated-marker";
import { ReservationInternalNoteIndicator } from "@/components/reservations/reservation-internal-note-indicator";
import { reservationInternalNoteText } from "@/lib/reservations/reservation-internal-note";
import { usePublicHolidaysByDate } from "@/lib/hooks/use-public-holidays-by-date";
import { useShiftPlanWeatherByDate } from "@/lib/hooks/use-shift-plan-weather-by-date";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { ShiftPlanDayWeatherRow } from "@/lib/weather/shift-plan-day-weather";
import {
  createRestaurantDateTimeFormatter,
  restaurantDayBoundsIso,
  restaurantTodayYmd,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { hasModuleRead, hasModuleCreate } from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import {
  moduleSearchFieldWrapClassName,
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonClassName,
  moduleSearchFilterButtonWrapClassName,
  moduleSearchFilterRowClassName,
  moduleSearchInputClassName,
} from "@/lib/ui/module-search-filter-toolbar";
import { publicHolidayChipClassName } from "@/lib/ui/public-holiday-chip";
import { reservationMatchesGuestSearch } from "@/lib/reservations/reservation-guest-search";
import { useReservationGwadaReviews } from "@/lib/hooks/use-reservation-gwada-reviews";
import type { ReservationGwadaReviewSummary } from "@/lib/reviews/reservation-gwada-review-types";
import { cn } from "@/lib/utils";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { reservationListRowButtonClassName } from "@/lib/ui/reservation-list-row-interactive";
import {
  keepAliveMayNavigate,
  keepAliveOwnsPathname,
} from "@/lib/navigation/module-home-keep-alive";
import { DayReservationsDrawer } from "@/components/reservations/day-reservations-drawer";
import { ReservationDayNoteOverviewChip } from "@/components/reservations/reservation-day-note-overview-chip";
import { ReservationDayShiftStaffOverviewChip } from "@/components/reservations/reservation-day-shift-staff-overview-chip";
import { ReservationDayShiftStaffSheet } from "@/components/reservations/reservation-day-shift-staff-sheet";
import { ReservationDayNotesSheet } from "@/components/reservations/reservation-day-notes-sheet";
import { fetchReservationDayNoteCountsForRange } from "@/lib/supabase/reservation-day-notes-db";
import { fetchScheduledStaffCountsByDayForRange } from "@/lib/supabase/staff-shift-schedule-db";
import { ReservationGwadaReviewSheet } from "@/components/reservations/reservation-gwada-review-sheet";
import { ReservationGwadaReviewStarButton } from "@/components/reservations/reservation-gwada-review-star-button";
import { ReservationQuickAcceptButton } from "@/components/reservations/reservation-quick-accept-button";
import { ReservationEditDrawer } from "@/components/reservations/reservation-edit-drawer";
import { ReservationsFilterDrawer } from "@/components/reservations/reservations-filter-drawer";
import { ReservationsOverviewPeriodStats } from "@/components/reservations/reservations-overview-period-stats";
import { ReservationsOverviewSkeleton } from "@/components/reservations/reservations-overview-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  GWADA_DASHBOARD_RESERVATIONS_LIVE_INSERT_EVENT,
  type DashboardReservationsLiveInsertDetail,
} from "@/lib/dashboard/dashboard-live-events";
import { useReservationsListQuery } from "@/lib/hooks/use-reservations-list-query";
import { patchReservationsMonthQueryCache } from "@/lib/reservations/reservations-list-query";
import {
  reservationInsertInMonthRange,
  reservationEndsAtFromLiveInsert,
  reservationLiveInsertListRowRaw,
} from "@/lib/dashboard/patch-dashboard-reservations-live-client";
import { mapRawToReservationListRow } from "@/lib/supabase/reservations-db";
import {
  formatReservationAssigneeNames,
} from "@/lib/supabase/reservation-staff-assignees-db";
import {
  isPrivateEventReservation,
  normalizeReservationKind,
  RESERVATION_KIND_PRIVATE_EVENT,
  reservationListStripeHex,
  type ReservationKind,
} from "@/lib/reservations/reservation-kind";

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

function gridDayKey(d: Date, timeZone: string): string {
  return restaurantZonedDateKey(d, timeZone);
}

function localHmFromDate(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dayKeyFromIso(iso: string, timeZone: string): string {
  return restaurantZonedDateKey(new Date(iso), timeZone);
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

  const setYearMonth = (year: number, month: number) => {
    setCursor({ year, month });
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

  return { cursor, setMonth, setYear, setYearMonth, prevMonth, nextMonth };
}

export function ReservationsOverview({ active = true }: { active?: boolean }) {
  const activeRef = useRef(active);
  activeRef.current = active;

  const { cursor, setMonth, setYear, setYearMonth, prevMonth, nextMonth } =
    useMonthCursor();

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
  const monthRange = useMemo(
    () => ({
      rangeStartIso,
      rangeEndExclusiveIso,
    }),
    [rangeStartIso, rangeEndExclusiveIso],
  );

  const {
    restaurantId: workspaceRestaurantId,
    supabaseEnvOk,
    ready: workspaceReady,
  } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(workspaceRestaurantId);
  const todayYmd = restaurantTodayYmd(restaurantTimeZone);
  const today = useMemo(() => {
    const [y, m, d] = todayYmd.split("-").map(Number);
    return startOfLocalDay(new Date(y!, (m ?? 1) - 1, d ?? 1));
  }, [todayYmd]);
  const timeFmt = useMemo(
    () =>
      createRestaurantDateTimeFormatter(restaurantTimeZone, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [restaurantTimeZone],
  );
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "reservations");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlUnconfirmedMode =
    searchParams.get(RESERVATIONS_UNCONFIRMED_QUERY) === "1";
  /** Switch / Badge — sofort, damit der Toggle nicht auf Navigation wartet. */
  const [unconfirmedUi, setUnconfirmedUi] = useState(urlUnconfirmedMode);
  /** Liste / Query — in startTransition, damit der Drawer nicht einfriert. */
  const [unconfirmedMode, setUnconfirmedModeCommitted] =
    useState(urlUnconfirmedMode);

  useEffect(() => {
    setUnconfirmedUi(urlUnconfirmedMode);
    setUnconfirmedModeCommitted(urlUnconfirmedMode);
  }, [urlUnconfirmedMode]);

  const monthFromYmd = gridDayKey(monthStart, restaurantTimeZone);
  const monthToYmd = gridDayKey(monthEnd, restaurantTimeZone);
  const isViewingCurrentMonth = monthFromYmd.slice(0, 7) === todayYmd.slice(0, 7);
  const { byDate: holidaysByDate } = usePublicHolidaysByDate(
    workspaceRestaurantId,
    monthFromYmd,
    monthToYmd,
  );

  const [daySheetOpen, setDaySheetOpen] = useState(false);
  const [daySheetDay, setDaySheetDay] = useState<Date | null>(null);
  /** Lokal öffnen (sofort) — URL nur sync, sonst wartet das Sheet auf router.push. */
  const [reservationSheet, setReservationSheet] = useState<
    | null
    | { mode: "edit"; id: string }
    | {
        mode: "create";
        day: Date;
        timeHm?: string;
        diningTableId?: string;
        contactId?: string;
        kind?: ReservationKind;
      }
  >(null);
  const pendingReopenDaySheetRef = useRef<Date | null>(null);
  const [urlReservation, setUrlReservation] = useState<ReservationListRow | null>(
    null,
  );
  const queryClient = useQueryClient();
  const dbOk =
    supabaseEnvOk && workspaceReady && workspaceRestaurantId !== null;
  const weatherDayKeys = useMemo(
    () => days.map((d) => gridDayKey(d, restaurantTimeZone)),
    [days, restaurantTimeZone],
  );
  const { weatherByDate } = useShiftPlanWeatherByDate(
    weatherDayKeys,
    dbOk && active,
  );
  const {
    rows,
    isLoading: loading,
    error: reservationsQueryError,
    invalidateAll: invalidateReservations,
  } = useReservationsListQuery({
    restaurantId: workspaceRestaurantId,
    enabled: dbOk && active,
    unconfirmedMode,
    range: monthRange,
  });
  const loadError = reservationsQueryError
    ? reservationsQueryError instanceof Error
      ? reservationsQueryError.message
      : String(reservationsQueryError)
    : null;
  const [filterOpen, setFilterOpen] = useState(false);
  const [guestSearch, setGuestSearch] = useState("");
  const [statusFilterId, setStatusFilterId] = useState("all");
  /** Nur Auswirkung in Kombination mit aktuellem Monat + `visibleDays`. */
  const [hidePastReservations, setHidePastReservations] = useState(true);
  const [hideEmptyDays, setHideEmptyDays] = useState(false);
  const guestSearchActive = guestSearch.trim().length > 0;
  const [gwadaReviewSheet, setGwadaReviewSheet] = useState<{
    review: ReservationGwadaReviewSummary;
    guestLabel: string;
    reservationNumber: number | null;
  } | null>(null);
  const [dayNoteCountsByDate, setDayNoteCountsByDate] = useState<
    Map<string, number>
  >(new Map());
  const [shiftStaffCountsByDate, setShiftStaffCountsByDate] = useState<
    Map<string, number>
  >(new Map());
  const [dayNotesReloadNonce, setDayNotesReloadNonce] = useState(0);
  const [dayNotesSheetOpen, setDayNotesSheetOpen] = useState(false);
  const [dayNotesSheetDay, setDayNotesSheetDay] = useState<Date | null>(null);
  const [shiftStaffSheetOpen, setShiftStaffSheetOpen] = useState(false);
  const [shiftStaffSheetDay, setShiftStaffSheetDay] = useState<Date | null>(
    null,
  );
  const onShiftStaffCountResolved = useCallback((key: string, count: number) => {
    setShiftStaffCountsByDate((prev) => {
      if (prev.get(key) === count) return prev;
      const next = new Map(prev);
      if (count > 0) next.set(key, count);
      else next.delete(key);
      return next;
    });
  }, []);

  const reservationIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const gwadaReviewsByReservation = useReservationGwadaReviews(
    workspaceRestaurantId,
    reservationIds,
  );

  const reservationIdParam = searchParams.get("reservation");
  const isNewParam = searchParams.get("new") === "1";
  const dayParam = searchParams.get("day");
  const createTimeParam = searchParams.get("time");
  const createTableParam = searchParams.get("table");
  const createContactParam = searchParams.get("contact");
  const createKindParam = searchParams.get("kind");

  useEffect(() => {
    // Keep-alive: URL nur anfassen, wenn Übersicht wirklich sichtbar ist.
    if (!keepAliveMayNavigate(active)) return;
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
    const c = searchParams.get("contact");
    if (c && !isUuidRestaurantId(c)) {
      p.delete("contact");
      bad = true;
    }
    if (bad) {
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }, [active, isNewParam, searchParams, pathname, router]);

  useEffect(() => {
    if (!keepAliveOwnsPathname(active, pathname, "reservierungen")) return;
    const rid = searchParams.get("reservation");
    if (rid && !isUuidRestaurantId(rid)) {
      router.replace(pathname, { scroll: false });
    }
  }, [active, searchParams, pathname, router]);

  const showInitialLoadSkeleton = useDeferredSkeleton(
    dbOk && loading && rows.length === 0,
  );

  useEffect(() => {
    if (!keepAliveMayNavigate(active)) {
      setUrlReservation(null);
      return;
    }
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
      if (
        !keepAliveOwnsPathname(
          activeRef.current,
          pathname,
          "reservierungen",
        )
      ) {
        return;
      }
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
  }, [
    active,
    reservationIdParam,
    rows,
    dbOk,
    workspaceRestaurantId,
    pathname,
    router,
  ]);

  useEffect(() => {
    if (!workspaceRestaurantId || !dbOk) {
      setDayNoteCountsByDate(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await fetchReservationDayNoteCountsForRange(
        workspaceRestaurantId,
        monthFromYmd,
        monthToYmd,
      );
      if (cancelled) return;
      if (error) {
        setDayNoteCountsByDate(new Map());
        return;
      }
      setDayNoteCountsByDate(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    workspaceRestaurantId,
    dbOk,
    monthFromYmd,
    monthToYmd,
    dayNotesReloadNonce,
  ]);

  const editReservationId =
    reservationSheet?.mode === "edit" ? reservationSheet.id : null;

  const editReservation = useMemo((): ReservationListRow | null => {
    if (!editReservationId || !isUuidRestaurantId(editReservationId)) {
      return null;
    }
    return rows.find((r) => r.id === editReservationId) ?? urlReservation;
  }, [editReservationId, rows, urlReservation]);

  const createFor =
    reservationSheet?.mode === "create" && workspaceRestaurantId
      ? {
          restaurantId: workspaceRestaurantId,
          day: reservationSheet.day,
          ...(reservationSheet.timeHm
            ? { initialTimeHm: reservationSheet.timeHm }
            : {}),
          ...(reservationSheet.diningTableId
            ? { initialDiningTableId: reservationSheet.diningTableId }
            : {}),
          ...(reservationSheet.contactId
            ? { initialContactId: reservationSheet.contactId }
            : {}),
          ...(reservationSheet.kind
            ? { initialKind: reservationSheet.kind }
            : {}),
        }
      : null;

  const editOpen = Boolean(
    (reservationSheet?.mode === "edit" && editReservation) ||
      (reservationSheet?.mode === "create" && Boolean(workspaceRestaurantId)),
  );

  // Deep-Link / Zurück: URL → Sheet (Öffnen per Klick setzt State schon vorher).
  useEffect(() => {
    if (!keepAliveMayNavigate(active)) {
      setReservationSheet(null);
      return;
    }
    if (isNewParam) {
      let day = startOfLocalDay(new Date());
      if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
        const [y, m, dd] = dayParam.split("-").map(Number);
        day = new Date(y!, m! - 1, dd);
      }
      const timeHm =
        createTimeParam && /^\d{2}:\d{2}$/.test(createTimeParam.trim())
          ? createTimeParam.trim()
          : undefined;
      const diningTableId =
        createTableParam && isUuidRestaurantId(createTableParam)
          ? createTableParam
          : undefined;
      const contactId =
        createContactParam && isUuidRestaurantId(createContactParam)
          ? createContactParam
          : undefined;
      const kindFromUrl =
        createKindParam === RESERVATION_KIND_PRIVATE_EVENT
          ? RESERVATION_KIND_PRIVATE_EVENT
          : createKindParam === "guest"
            ? normalizeReservationKind("guest")
            : undefined;
      setReservationSheet((prev) => {
        if (prev?.mode === "create") {
          return {
            mode: "create",
            day: prev.day,
            timeHm: timeHm ?? prev.timeHm,
            diningTableId: diningTableId ?? prev.diningTableId,
            contactId: contactId ?? prev.contactId,
            kind: kindFromUrl ?? prev.kind,
          };
        }
        return {
          mode: "create",
          day,
          timeHm,
          diningTableId,
          contactId,
          ...(kindFromUrl ? { kind: kindFromUrl } : {}),
        };
      });
      return;
    }
    if (reservationIdParam && isUuidRestaurantId(reservationIdParam)) {
      setReservationSheet((prev) =>
        prev?.mode === "edit" && prev.id === reservationIdParam
          ? prev
          : { mode: "edit", id: reservationIdParam },
      );
      return;
    }
    setReservationSheet(null);
  }, [
    active,
    isNewParam,
    dayParam,
    reservationIdParam,
    createTimeParam,
    createTableParam,
    createContactParam,
    createKindParam,
  ]);

  /** `?day=YYYY-MM-DD` (ohne new): Monat springen + Tagesblatt — z. B. Suche „Zum Tag“. */
  const appliedDayDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!keepAliveOwnsPathname(active, pathname, "reservierungen")) return;
    if (isNewParam) return;
    if (!dayParam || !/^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
      appliedDayDeepLinkRef.current = null;
      return;
    }
    if (appliedDayDeepLinkRef.current === dayParam) return;
    appliedDayDeepLinkRef.current = dayParam;

    const [y, m, dd] = dayParam.split("-").map(Number);
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(dd)
    ) {
      return;
    }
    setYearMonth(y!, m! - 1);
    const hasReservation =
      Boolean(reservationIdParam) && isUuidRestaurantId(reservationIdParam!);
    if (!hasReservation) {
      setDaySheetDay(new Date(y!, m! - 1, dd!));
      setDaySheetOpen(true);
    }

    const p = new URLSearchParams(searchParams.toString());
    p.delete("day");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    active,
    dayParam,
    isNewParam,
    reservationIdParam,
    searchParams,
    pathname,
    router,
    setYearMonth,
  ]); // keepAliveOwnsPathname(active, pathname, …)

  /** Edit-Deep-Link: Monat der Reservierung zeigen (nicht immer „heute“). */
  const syncedMonthForReservationRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editReservationId) {
      syncedMonthForReservationRef.current = null;
      return;
    }
    if (!editReservation?.starts_at) return;
    if (syncedMonthForReservationRef.current === editReservation.id) return;
    syncedMonthForReservationRef.current = editReservation.id;
    const ymd = dayKeyFromIso(editReservation.starts_at, restaurantTimeZone);
    const [y, m] = ymd.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return;
    setYearMonth(y!, m! - 1);
  }, [
    editReservationId,
    editReservation?.id,
    editReservation?.starts_at,
    restaurantTimeZone,
    setYearMonth,
  ]);

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
      if (!keepAliveOwnsPathname(active, pathname, "reservierungen")) return;
      setReservationSheet({ mode: "edit", id });
      const p = new URLSearchParams();
      p.set("reservation", id);
      withUnconfirmedParam(p);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [active, router, pathname, withUnconfirmedParam],
  );

  const pushReservationCreate = useCallback(
    (
      d: Date,
      extras?: {
        timeHm?: string;
        diningTableId?: string;
        kind?: ReservationKind;
      },
    ) => {
      if (!keepAliveOwnsPathname(active, pathname, "reservierungen")) return;
      const kind = extras?.kind
        ? normalizeReservationKind(extras.kind)
        : undefined;
      setReservationSheet({
        mode: "create",
        day: d,
        ...(extras?.timeHm && /^\d{2}:\d{2}$/.test(extras.timeHm)
          ? { timeHm: extras.timeHm }
          : {}),
        ...(extras?.diningTableId && isUuidRestaurantId(extras.diningTableId)
          ? { diningTableId: extras.diningTableId }
          : {}),
        ...(kind ? { kind } : {}),
      });
      const p = new URLSearchParams();
      p.set("new", "1");
      p.set("day", gridDayKey(d, restaurantTimeZone));
      if (extras?.timeHm && /^\d{2}:\d{2}$/.test(extras.timeHm)) {
        p.set("time", extras.timeHm);
      }
      if (extras?.diningTableId && isUuidRestaurantId(extras.diningTableId)) {
        p.set("table", extras.diningTableId);
      }
      if (kind === RESERVATION_KIND_PRIVATE_EVENT) {
        p.set("kind", RESERVATION_KIND_PRIVATE_EVENT);
      }
      withUnconfirmedParam(p);
      router.push(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [active, router, pathname, withUnconfirmedParam, restaurantTimeZone],
  );

  const clearReservationUrl = useCallback(() => {
    setReservationSheet(null);
    // Soft-Nav: Drawer schließt mit Ziel-pathname — URL nicht auf fremdem Modul mutieren.
    if (!keepAliveOwnsPathname(active, pathname, "reservierungen")) return;
    if (unconfirmedMode) {
      const p = new URLSearchParams();
      p.set(RESERVATIONS_UNCONFIRMED_QUERY, "1");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
      return;
    }
    router.replace(pathname, { scroll: false });
  }, [active, router, pathname, unconfirmedMode]);

  const setUnconfirmedMode = useCallback(
    (enabled: boolean) => {
      if (!keepAliveMayNavigate(active)) return;
      setUnconfirmedUi(enabled);
      startTransition(() => {
        setUnconfirmedModeCommitted(enabled);
        if (!keepAliveOwnsPathname(active, pathname, "reservierungen")) return;
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
      });
    },
    [active, router, pathname, searchParams],
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
    // Auch versteckt: Cache warm halten (kein Fetch, nur Live-Patch).
    if (!workspaceRestaurantId || unconfirmedMode) return;

    const onLiveInsert = (event: Event) => {
      const detail = (event as CustomEvent<DashboardReservationsLiveInsertDetail>)
        .detail;
      if (!detail || detail.restaurantId !== workspaceRestaurantId) return;
      if (!reservationInsertInMonthRange(detail.insert.starts_at, monthRange)) {
        return;
      }

      const stubRow = mapRawToReservationListRow(
        reservationLiveInsertListRowRaw(detail.insert, detail.restaurantId),
      );

      patchReservationsMonthQueryCache(
        queryClient,
        workspaceRestaurantId,
        monthRange,
        (prev) => {
          if (prev.some((r) => r.id === detail.insert.id)) return prev;
          return [...prev, stubRow].sort(
            (a, b) =>
              new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
          );
        },
      );
    };

    window.addEventListener(
      GWADA_DASHBOARD_RESERVATIONS_LIVE_INSERT_EVENT,
      onLiveInsert,
    );
    return () => {
      window.removeEventListener(
        GWADA_DASHBOARD_RESERVATIONS_LIVE_INSERT_EVENT,
        onLiveInsert,
      );
    };
  }, [workspaceRestaurantId, unconfirmedMode, monthRange, queryClient]);

  useEffect(() => {
    if (unconfirmedMode) {
      setStatusFilterId("all");
      // Unbestätigt zeigt alle Termine inkl. Vergangenheit.
      setHidePastReservations(false);
      return;
    }
    // Beim Verlassen wieder Standard — sonst bleibt Badge „1“ (Vergangene Tage).
    setHidePastReservations(true);
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
    let out = rows;
    if (statusFilterId !== "all") {
      out = out.filter((r) => r.reservation_statuses?.id === statusFilterId);
    }
    if (guestSearch.trim()) {
      const q = guestSearch;
      out = out.filter((r) => reservationMatchesGuestSearch(r, q));
    }
    return out;
  }, [rows, statusFilterId, guestSearch]);

  const byDay = useMemo(() => {
    const map = new Map<string, ReservationListRow[]>();
    const rangeStartMs = new Date(rangeStartIso).getTime();
    const rangeEndMs = new Date(rangeEndExclusiveIso).getTime();
    const push = (r: ReservationListRow) => {
      const k = dayKeyFromIso(r.starts_at, restaurantTimeZone);
      const arr = map.get(k);
      if (arr) arr.push(r);
      else map.set(k, [r]);
    };
    for (const r of rowsFiltered) {
      if (isRelocatedMarkerRow(r)) continue;
      const startMs = new Date(r.starts_at).getTime();
      const inLiveRange =
        unconfirmedMode || (startMs >= rangeStartMs && startMs < rangeEndMs);
      if (inLiveRange) push(r);
      const marker = relocatedMarkerListRowFromReservation(r);
      if (!marker) continue;
      const oldMs = new Date(marker.starts_at).getTime();
      if (
        unconfirmedMode ||
        (oldMs >= rangeStartMs && oldMs < rangeEndMs)
      ) {
        push(marker);
      }
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
    }
    return map;
  }, [
    rowsFiltered,
    restaurantTimeZone,
    unconfirmedMode,
    rangeStartIso,
    rangeEndExclusiveIso,
  ]);

  const unconfirmedDayList = useMemo(() => {
    const keys = [...byDay.keys()].sort();
    return keys.map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y!, (m ?? 1) - 1, d ?? 1);
    });
  }, [byDay]);

  const visibleDays = useMemo(() => {
    const hasRows = (d: Date) =>
      (byDay.get(gridDayKey(d, restaurantTimeZone))?.length ?? 0) > 0;

    if (unconfirmedMode) {
      if (!hideEmptyDays && !guestSearchActive) return unconfirmedDayList;
      return unconfirmedDayList.filter(hasRows);
    }
    let out = days;
    // Bei Namenssuche auch vergangene Tage des Monats zeigen.
    if (
      isViewingCurrentMonth &&
      hidePastReservations &&
      !guestSearchActive
    ) {
      out = out.filter(
        (d) => gridDayKey(d, restaurantTimeZone) >= todayYmd,
      );
    }
    if (hideEmptyDays || guestSearchActive) {
      out = out.filter(hasRows);
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
    guestSearchActive,
    restaurantTimeZone,
    todayYmd,
  ]);

  const visiblePeriodStats = useMemo(() => {
    let reservationCount = 0;
    let guestCount = 0;
    let daysWithReservations = 0;
    for (const d of visibleDays) {
      const list = byDay.get(gridDayKey(d, restaurantTimeZone)) ?? [];
      const live = list.filter(reservationCountsTowardDayStats);
      if (live.length > 0) daysWithReservations++;
      reservationCount += live.length;
      guestCount += live.reduce((sum, r) => sum + r.party_size, 0);
    }
    return {
      reservationCount,
      guestCount,
      avgPartySize:
        reservationCount > 0 ? guestCount / reservationCount : 0,
      daysWithReservations,
      dayCount: visibleDays.length,
    };
  }, [visibleDays, byDay, restaurantTimeZone]);

  /** Schichtplan-Counts unabhängig vom Reservierungsfilter; Unbestätigt kann Monate spannen. */
  const shiftStaffCountRange = useMemo(() => {
    if (!unconfirmedMode) {
      const first = gridDayKey(monthStart, restaurantTimeZone);
      const last = gridDayKey(monthEnd, restaurantTimeZone);
      return {
        start: restaurantDayBoundsIso(first, restaurantTimeZone).start,
        end: restaurantDayBoundsIso(last, restaurantTimeZone).end,
      };
    }
    const keys = [...byDay.keys()].sort();
    if (keys.length === 0) {
      const first = gridDayKey(monthStart, restaurantTimeZone);
      const last = gridDayKey(monthEnd, restaurantTimeZone);
      return {
        start: restaurantDayBoundsIso(first, restaurantTimeZone).start,
        end: restaurantDayBoundsIso(last, restaurantTimeZone).end,
      };
    }
    const first = keys[0]!;
    const last = keys[keys.length - 1]!;
    return {
      start: restaurantDayBoundsIso(first, restaurantTimeZone).start,
      end: restaurantDayBoundsIso(last, restaurantTimeZone).end,
    };
  }, [
    unconfirmedMode,
    byDay,
    monthStart,
    monthEnd,
    restaurantTimeZone,
  ]);

  useEffect(() => {
    if (!workspaceRestaurantId || !dbOk) {
      setShiftStaffCountsByDate(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await fetchScheduledStaffCountsByDayForRange(
        workspaceRestaurantId,
        shiftStaffCountRange.start,
        shiftStaffCountRange.end,
        restaurantTimeZone,
      );
      if (cancelled) return;
      if (error) {
        setShiftStaffCountsByDate(new Map());
        return;
      }
      setShiftStaffCountsByDate(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    workspaceRestaurantId,
    dbOk,
    shiftStaffCountRange.start,
    shiftStaffCountRange.end,
    restaurantTimeZone,
  ]);

  const filterActiveCount = useMemo(() => {
    if (unconfirmedUi) {
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
    unconfirmedUi,
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
          <p className="order-2 min-w-0 text-xs text-muted-foreground sm:order-1 sm:flex-1">
            {guestSearchActive
              ? "Treffer zur Namenssuche im gewählten Zeitraum (Tippfehler ok)."
              : unconfirmedUi
                ? "Offen und „Änderung prüfen“ — alle Monate, nach Termin sortiert."
                : isViewingCurrentMonth && hidePastReservations
                  ? "Tage ab heute bis Monatsende."
                  : "Alle Tage des gewählten Monats."}
            {!guestSearchActive && hideEmptyDays
              ? " Tage ohne Reservierungen ausgeblendet."
              : ""}
            {!unconfirmedUi && statusFilterId !== "all"
              ? " Nur gewählter Status."
              : ""}
          </p>
          <div className="order-1 flex w-full items-center justify-center gap-1 sm:order-2 sm:w-auto sm:shrink-0 sm:justify-end">
            {!unconfirmedUi ? (
              <>
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
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={moduleSearchFilterRowClassName}>
            <div className={moduleSearchFieldWrapClassName}>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder="Name, Firma, Telefon, #Nummer …"
                className={moduleSearchInputClassName}
                aria-label="Reservierungen nach Namen suchen"
              />
            </div>
            <div className={moduleSearchFilterButtonWrapClassName}>
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                className={moduleSearchFilterButtonClassName}
                aria-label="Filter"
                onClick={() => setFilterOpen(true)}
              >
                <Filter className="size-4" />
              </Button>
              {filterActiveCount > 0 ? (
                <Badge
                  variant="secondary"
                  className={moduleSearchFilterActiveBadgeClassName}
                >
                  {filterActiveCount}
                </Badge>
              ) : null}
            </div>
          </div>
        </CardContent>
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
          {guestSearchActive
            ? "Keine Treffer zur Suche im gewählten Zeitraum."
            : unconfirmedMode
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
          const key = gridDayKey(d, restaurantTimeZone);
          const holidayName = holidaysByDate[key];
          const list = byDay.get(key) ?? [];
          const liveList = list.filter(reservationCountsTowardDayStats);
          const resCount = liveList.length;
          const partyTotal = liveList.reduce((sum, r) => sum + r.party_size, 0);
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
                      <CardTitle
                        className="cursor-pointer text-base font-semibold transition-colors hover:text-accent sm:text-lg"
                        onClick={() => {
                          setDaySheetDay(d);
                          setDaySheetOpen(true);
                        }}
                      >
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
                      <ShiftPlanDayWeatherRow
                        weather={weatherByDate.get(key)}
                        inline
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                      <span>
                        {resCount === 1
                          ? "1 Reservierung"
                          : `${resCount} Reservierungen`}
                      </span>
                      <span aria-hidden>·</span>
                      <span>
                        {partyTotal === 1
                          ? "1 Person"
                          : `${partyTotal} Personen`}
                      </span>
                      {/* Unabhängig vom Reservierungs-Statusfilter — Schichtplan-Stand. */}
                      {(shiftStaffCountsByDate.get(key) ?? 0) > 0 ? (
                        <>
                          <span aria-hidden>·</span>
                          <ReservationDayShiftStaffOverviewChip
                            count={shiftStaffCountsByDate.get(key) ?? 0}
                            onClick={() => {
                              setShiftStaffSheetDay(d);
                              setShiftStaffSheetOpen(true);
                            }}
                          />
                        </>
                      ) : null}
                      {(dayNoteCountsByDate.get(key) ?? 0) > 0 ? (
                        <>
                          <span aria-hidden>·</span>
                          <ReservationDayNoteOverviewChip
                            count={dayNoteCountsByDate.get(key) ?? 0}
                            onClick={() => {
                              setDayNotesSheetDay(d);
                              setDayNotesSheetOpen(true);
                            }}
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardHeader>
              {list.length > 0 ? (
                <>
                  <Separator className="mx-6" />
                  <CardContent className="space-y-1.5 py-2">
                    {list.map((r) => {
                      const st = r.reservation_statuses;
                      const isMovedMarker = isRelocatedMarkerRow(r);
                      const isEvent = isPrivateEventReservation(r);
                      const stripe = reservationListStripeHex(r);
                      const guest =
                        `${r.guest_first_name} ${r.guest_last_name}`.trim();
                      const timeLabel = timeFmt.format(new Date(r.starts_at));
                      const endLabel = timeFmt.format(
                        new Date(reservationEndsAtFromLiveInsert(r)),
                      );
                      const tableLabel = isEvent
                        ? formatReservationQuotationJoinLabel(
                            r.accounting_quotation,
                          ) || null
                        : isMovedMarker
                          ? reservationAssignedTableLabel(r)
                          : reservationDiningTableLabel(r);
                      const assigneeNames = isEvent
                        ? formatReservationAssigneeNames(r.assigned_staff)
                        : "";
                      const liveId = liveReservationIdFromListRowId(r.id);
                      const gwadaReview = isMovedMarker
                        ? undefined
                        : gwadaReviewsByReservation.get(r.id);
                      return (
                        <div
                          key={r.id}
                          className={cn(
                            "flex items-stretch gap-1.5",
                            isMovedMarker && "opacity-80",
                          )}
                        >
                          <button
                            type="button"
                            className={cn(
                              "min-w-0 flex-1",
                              reservationListRowButtonClassName,
                            )}
                            aria-label={
                              isMovedMarker
                                ? `Verschobene Reservierung ${guest} öffnen`
                                : isEvent
                                  ? `Veranstaltung ${guest} bearbeiten`
                                  : `Reservierung ${guest} bearbeiten`
                            }
                            onClick={() => {
                              pushReservationEdit(liveId);
                            }}
                          >
                            <div className="flex gap-3">
                          <div
                            className="mt-0.5 w-0.5 shrink-0 self-stretch rounded-full sm:mt-0"
                            style={{ backgroundColor: stripe }}
                            aria-hidden
                          />
                          <div
                            className={cn(
                              "grid min-w-0 flex-1 items-start gap-x-3 gap-y-0.5",
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
                                {isEvent ? (
                                  <span className="rounded-md border border-violet-500/40 bg-violet-500/15 px-1.5 py-px text-[10px] font-medium text-violet-800 dark:text-violet-200">
                                    Veranstaltung
                                  </span>
                                ) : null}
                                {st?.code === "change_requested" ? (
                                  <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:text-amber-200">
                                    Änderung prüfen
                                  </span>
                                ) : null}
                                {st?.code === RESERVATION_MOVED_STATUS_CODE ? (
                                  <span className="rounded-md border border-indigo-500/40 bg-indigo-500/15 px-1.5 py-px text-[10px] font-medium text-indigo-800 dark:text-indigo-200">
                                    Verschoben
                                  </span>
                                ) : null}
                                {tableLabel ? (
                                  <span className="rounded-md border border-border/50 bg-background/80 px-1.5 py-px text-[11px] font-medium text-foreground">
                                    {tableLabel}
                                  </span>
                                ) : null}
                                {!isMovedMarker &&
                                reservationInternalNoteText(r.notes) ? (
                                  <ReservationInternalNoteIndicator />
                                ) : null}
                              </div>
                            </div>
                            <div className="col-start-2 row-start-2 min-w-0 flex flex-col gap-0.5">
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
                              </div>
                              {r.guest_email ? (
                                <div className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                                  {r.guest_email}
                                </div>
                              ) : null}
                              {assigneeNames ? (
                                <div className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                                  Team: {assigneeNames}
                                </div>
                              ) : null}
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
                            </div>
                          </button>
                          {workspaceRestaurantId &&
                          !isMovedMarker &&
                          st?.code === "pending" ? (
                            <div className="flex shrink-0 items-center self-center pr-0.5">
                              <ReservationQuickAcceptButton
                                restaurantId={workspaceRestaurantId}
                                reservationId={r.id}
                                statusCode={st.code}
                                onConfirmed={() => {}}
                                onFailed={() => {
                                  void invalidateReservations();
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
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
        unconfirmedMode={unconfirmedUi}
        statusOptions={statusFilterOptions}
        statusFilterId={statusFilterId}
        onStatusFilterIdChange={setStatusFilterId}
        showHidePastSection={!unconfirmedUi && isViewingCurrentMonth}
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
          daySheetDay ? (byDay.get(gridDayKey(daySheetDay, restaurantTimeZone)) ?? []) : []
        }
        onEdit={(r) => {
          if (daySheetDay) {
            pendingReopenDaySheetRef.current = new Date(daySheetDay.getTime());
          }
          setDaySheetOpen(false);
          pushReservationEdit(liveReservationIdFromListRowId(r.id));
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
        onDataChanged={invalidateReservations}
        onDayNotesChanged={() => setDayNotesReloadNonce((n) => n + 1)}
      />

      <ReservationDayNotesSheet
        open={dayNotesSheetOpen}
        onOpenChange={(open) => {
          setDayNotesSheetOpen(open);
          if (!open) setDayNotesSheetDay(null);
        }}
        restaurantId={workspaceRestaurantId}
        serviceDate={
          dayNotesSheetDay ? gridDayKey(dayNotesSheetDay, restaurantTimeZone) : null
        }
        dayLabel={
          dayNotesSheetDay ? formatDayHeadingDe(dayNotesSheetDay) : null
        }
      />

      <ReservationDayShiftStaffSheet
        open={shiftStaffSheetOpen}
        onOpenChange={(open) => {
          setShiftStaffSheetOpen(open);
          if (!open) setShiftStaffSheetDay(null);
        }}
        restaurantId={workspaceRestaurantId}
        dayKey={
          shiftStaffSheetDay
            ? gridDayKey(shiftStaffSheetDay, restaurantTimeZone)
            : null
        }
        dayLabel={
          shiftStaffSheetDay ? formatDayHeadingDe(shiftStaffSheetDay) : null
        }
        timeZone={restaurantTimeZone}
        onStaffCountResolved={onShiftStaffCountResolved}
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
          invalidateReservations();
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
