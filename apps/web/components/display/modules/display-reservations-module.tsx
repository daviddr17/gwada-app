"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutList, Loader2, MessageSquare, Plus, Rows3, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePickerField } from "@/components/ui/date-picker";
import { DisplayReservationDrawer } from "@/components/display/modules/display-reservation-drawer";
import { DisplayReservationEditDrawer } from "@/components/display/display-reservation-edit-drawer";
import {
  DisplayReservationMessageSheet,
  reservationHasContactChannel,
} from "@/components/display/display-reservation-message-sheet";
import { DisplayReservationTableField } from "@/components/display/display-reservation-table-field";
import { DisplayTimeRangeSlider } from "@/components/display/display-time-range-slider";
import { DisplayPeriodStatsBar } from "@/components/display/display-period-stats-bar";
import { DisplayOpenReservationCard } from "@/components/display/display-open-reservation-card";
import { AutoAssignTablesButton } from "@/components/reservations/auto-assign-tables-button";
import { formatDisplayChangeRequestHint } from "@/lib/reservations/reservation-pending-change";
import {
  dispatchReservationOpenResolvedLivePatch,
  nextStatusCodeAfterChangeRequestApprove,
  nextStatusCodeAfterChangeRequestDecline,
} from "@/lib/reservations/reservation-open-status";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import {
  normalizeBookingTimeStepMinutes,
  type BookingTimeStepMinutes,
} from "@/lib/reservations/booking-time-step";
import {
  fallbackSlotRangeFromReservations,
  localDateAtSlotMinutes,
  openingDayBookableSlotStartsMinutes,
  resolveHoursForLocalCalendarDay,
} from "@/lib/reservations/day-opening-slots";
import {
  computeTableSlotStats,
  reservationsAtTableForInstant,
  reservationsAtTableForRange,
} from "@/lib/reservations/reservations-table-occupancy";
import { formatDayHeadingDe } from "@/lib/reservations/month-range";
import { localDayToYmd } from "@/lib/reservations/datetime-local";
import { modulePrimaryAddButtonClassName } from "@/lib/ui/module-primary-add-button";
import type { DiningAreaRow, DiningTableRow } from "@/lib/supabase/dining-floor-db";
import { formatDiningTableSelectLabel } from "@/lib/supabase/dining-floor-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import type { DayHours, DateHoursException, Weekday } from "@/lib/types/restaurant";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  GWADA_DISPLAY_RESERVATIONS_LIVE_INSERT_EVENT,
  GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT,
  type DisplayReservationsLiveInsertDetail,
} from "@/lib/display/display-reservations-live-events";
import {
  displayReservationOnDay,
  patchDisplayDayFromReservationInsert,
} from "@/lib/display/patch-display-reservations-live-client";

type ReservationStatus = {
  id: string;
  code: string;
  name: string;
  color_hex: string;
};

type DayPayload = {
  day: string;
  restaurant_id: string;
  restaurant_name: string | null;
  reservations: DisplayReservationRow[];
  statuses: ReservationStatus[];
  areas: DiningAreaRow[];
  tables: DiningTableRow[];
  default_dwell_minutes: number;
  booking_time_step_minutes: BookingTimeStepMinutes;
  min_minutes_before_closing: number;
  next_reservation_number: number;
  weekly_hours: Record<Weekday, DayHours>;
  date_exceptions: DateHoursException[];
  stats: { count: number; guests: number };
  open_count: number;
};

type ViewMode = "list" | "occupancy" | "open";
type ListDensity = "comfortable" | "compact";

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

const DISPLAY_SESSION_ERRORS: Record<string, string> = {
  session_expired: "Sitzung abgelaufen — bitte erneut anmelden.",
  session_locked: "Bitte mit PIN anmelden.",
  module_forbidden: "Keine Berechtigung für Reservierungen.",
};

function reservationOverlapsSlotRange(
  r: DisplayReservationRow,
  day: Date,
  fromMin: number,
  toMin: number,
  stepMinutes: number,
): boolean {
  const rangeStart = localDateAtSlotMinutes(day, fromMin).getTime();
  const rangeEnd = localDateAtSlotMinutes(day, toMin + stepMinutes).getTime();
  const rStart = new Date(r.starts_at).getTime();
  const rEnd = new Date(r.ends_at).getTime();
  return rStart < rangeEnd && rEnd > rangeStart;
}

function sortReservationsByStart(
  rows: DisplayReservationRow[],
): DisplayReservationRow[] {
  return [...rows].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
}

/** Slider at both ends → show every reservation returned for the selected day (matches header stats). */
function isFullDaySlotRange(
  slotMinutes: number[],
  rangeSlotIndices: [number, number],
): boolean {
  if (slotMinutes.length === 0) return true;
  const lastIdx = slotMinutes.length - 1;
  return rangeSlotIndices[0] === 0 && rangeSlotIndices[1] === lastIdx;
}

export function DisplayReservationsModule() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DayPayload | null>(null);
  const showDataSkeleton = useDeferredSkeleton(loading && !payload);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [listDensity, setListDensity] = useState<ListDensity>("comfortable");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [rangeSlotIndices, setRangeSlotIndices] = useState<[number, number] | null>(
    null,
  );
  const lastSlotsKeyRef = useRef("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState<DisplayReservationRow | null>(
    null,
  );
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  const [openReservations, setOpenReservations] = useState<DisplayReservationRow[]>(
    [],
  );
  const [openLoading, setOpenLoading] = useState(false);
  const [selectedDayYmd, setSelectedDayYmd] = useState(() => localDayToYmd(new Date()));
  const hadLoadedRef = useRef(false);

  const selectedDay = useMemo(() => {
    const [y, m, d] = selectedDayYmd.split("-").map((v) => Number.parseInt(v, 10));
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }, [selectedDayYmd]);

  const isSelectedToday = useMemo(() => {
    const now = new Date();
    return localDayToYmd(now) === selectedDayYmd;
  }, [selectedDayYmd]);
  const bookingStep = normalizeBookingTimeStepMinutes(
    payload?.booking_time_step_minutes,
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch(
        `/api/display/reservations?day=${encodeURIComponent(selectedDayYmd)}`,
        {
          cache: "no-store",
          credentials: "include",
        },
      );
      const data = (await res.json()) as DayPayload & { error?: string };
      if (!res.ok) {
        toast.error(
          DISPLAY_SESSION_ERRORS[data.error ?? ""] ??
            "Reservierungen konnten nicht geladen werden.",
        );
        return;
      }
      setPayload(data);
    } catch {
      toast.error("Reservierungen konnten nicht geladen werden.");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [selectedDayYmd]);

  const loadOpen = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setOpenLoading(true);
    try {
      const res = await fetch("/api/display/reservations/open", {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await res.json()) as {
        reservations?: DisplayReservationRow[];
        count?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          DISPLAY_SESSION_ERRORS[data.error ?? ""] ??
            "Offene Reservierungen konnten nicht geladen werden.",
        );
        return;
      }
      setOpenReservations(data.reservations ?? []);
      setPayload((prev) =>
        prev ? { ...prev, open_count: data.count ?? data.reservations?.length ?? 0 } : prev,
      );
    } catch {
      toast.error("Offene Reservierungen konnten nicht geladen werden.");
    } finally {
      if (!opts?.silent) setOpenLoading(false);
    }
  }, []);

  useEffect(() => {
    setRangeSlotIndices(null);
    lastSlotsKeyRef.current = "";
  }, [selectedDayYmd]);

  const loadInFlightRef = useRef(false);
  const lastSilentLoadAtRef = useRef(0);
  const SILENT_LOAD_GAP_MS = 800;

  const applyOptimisticReservation = useCallback(
    (row: DisplayReservationRow) => {
      if (!displayReservationOnDay(row, selectedDayYmd)) return;
      setPayload((prev) => {
        if (!prev) return prev;
        const patched = patchDisplayDayFromReservationInsert(prev, row);
        return { ...prev, ...patched };
      });
      setLoading(false);
    },
    [selectedDayYmd],
  );

  const loadFromLive = useCallback(() => {
    const now = Date.now();
    if (
      loadInFlightRef.current ||
      now - lastSilentLoadAtRef.current < SILENT_LOAD_GAP_MS
    ) {
      return;
    }
    loadInFlightRef.current = true;
    lastSilentLoadAtRef.current = now;
    void load({ silent: true }).finally(() => {
      loadInFlightRef.current = false;
    });
  }, [load]);

  useEffect(() => {
    void load({ silent: hadLoadedRef.current });
    hadLoadedRef.current = true;

    const onLiveInsert = (event: Event) => {
      const detail = (event as CustomEvent<DisplayReservationsLiveInsertDetail>)
        .detail;
      if (!detail?.row) return;
      applyOptimisticReservation(detail.row);
    };

    const onLiveRefresh = () => {
      loadFromLive();
      void loadOpen({ silent: true });
    };

    window.addEventListener(
      GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT,
      onLiveRefresh,
    );
    window.addEventListener(
      GWADA_DISPLAY_RESERVATIONS_LIVE_INSERT_EVENT,
      onLiveInsert,
    );
    return () => {
      window.removeEventListener(
        GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT,
        onLiveRefresh,
      );
      window.removeEventListener(
        GWADA_DISPLAY_RESERVATIONS_LIVE_INSERT_EVENT,
        onLiveInsert,
      );
    };
  }, [load, loadFromLive, applyOptimisticReservation, loadOpen]);

  useEffect(() => {
    if (viewMode !== "open") return;
    void loadOpen();
  }, [viewMode, loadOpen]);

  const openCount = payload?.open_count ?? openReservations.length;

  const reservations = payload?.reservations ?? [];
  const statuses = payload?.statuses ?? [];
  const areas = payload?.areas ?? [];
  const tables = payload?.tables ?? [];

  useEffect(() => {
    if (!selectedAreaId && areas[0]) setSelectedAreaId(areas[0].id);
  }, [areas, selectedAreaId]);

  const tablesInArea = useMemo(
    () => tables.filter((t) => t.area_id === selectedAreaId),
    [tables, selectedAreaId],
  );

  const hoursForDay = useMemo(() => {
    if (!payload) return null;
    return resolveHoursForLocalCalendarDay(
      selectedDay,
      payload.weekly_hours,
      payload.date_exceptions,
    );
  }, [payload, selectedDay]);

  const slotMinutes = useMemo(() => {
    if (!hoursForDay) return [];
    const fallbackReservations = reservations.map((r) => ({
      starts_at: r.starts_at,
      ends_at: r.ends_at,
    })) as never[];
    const fallback = fallbackSlotRangeFromReservations(fallbackReservations, selectedDay);
    return openingDayBookableSlotStartsMinutes(
      hoursForDay,
      fallback,
      bookingStep,
      payload?.min_minutes_before_closing ?? 60,
    );
  }, [hoursForDay, reservations, selectedDay, bookingStep, payload?.min_minutes_before_closing]);

  useEffect(() => {
    if (slotMinutes.length === 0) return;
    const slotsKey = `${slotMinutes[0]}-${slotMinutes[slotMinutes.length - 1]}-${slotMinutes.length}`;
    if (slotsKey === lastSlotsKeyRef.current) return;
    lastSlotsKeyRef.current = slotsKey;

    setRangeSlotIndices(null);
  }, [slotMinutes]);

  const lastSlotIdx = Math.max(slotMinutes.length - 1, 0);
  const effectiveRangeSlotIndices: [number, number] =
    rangeSlotIndices ?? [0, lastSlotIdx];

  const fromMin = slotMinutes[effectiveRangeSlotIndices[0]] ?? 0;
  const toMin =
    slotMinutes[
      Math.min(effectiveRangeSlotIndices[1], lastSlotIdx)
    ] ?? fromMin;

  const filteredReservations = useMemo(() => {
    if (
      slotMinutes.length === 0 ||
      isFullDaySlotRange(slotMinutes, effectiveRangeSlotIndices)
    ) {
      return sortReservationsByStart(reservations);
    }
    return sortReservationsByStart(
      reservations.filter((r) =>
        reservationOverlapsSlotRange(r, selectedDay, fromMin, toMin, bookingStep),
      ),
    );
  }, [
    reservations,
    selectedDay,
    fromMin,
    toMin,
    bookingStep,
    slotMinutes.length,
    lastSlotIdx,
    rangeSlotIndices,
  ]);

  const occupancyInstant = useMemo(
    () => localDateAtSlotMinutes(selectedDay, toMin),
    [selectedDay, toMin],
  );

  const occupancyRange = useMemo(() => {
    const rangeStart = localDateAtSlotMinutes(selectedDay, fromMin);
    const rangeEnd = localDateAtSlotMinutes(selectedDay, toMin + bookingStep);
    return { rangeStart, rangeEnd };
  }, [selectedDay, fromMin, toMin, bookingStep]);

  const occupancy = useMemo(() => {
    if (slotMinutes.length === 0) return new Map<string, DisplayReservationRow[]>();
    const withStatus = reservations.map((r) => ({
      ...r,
      status: r.status,
    }));
    return reservationsAtTableForRange(
      tablesInArea,
      withStatus,
      occupancyRange.rangeStart,
      occupancyRange.rangeEnd,
      { includeSeated: true },
    );
  }, [tablesInArea, reservations, occupancyRange, slotMinutes.length]);

  const allTablesOccupancy = useMemo(() => {
    if (slotMinutes.length === 0) return new Map<string, DisplayReservationRow[]>();
    const withStatus = reservations.map((r) => ({
      ...r,
      status: r.status,
    }));
    return reservationsAtTableForInstant(
      tables,
      withStatus,
      occupancyInstant,
      { includeSeated: true },
    );
  }, [tables, reservations, occupancyInstant, slotMinutes.length]);

  const periodStats = useMemo(
    () => computeTableSlotStats(tables, allTablesOccupancy),
    [tables, allTablesOccupancy],
  );

  const filteredGuestCount = useMemo(
    () => filteredReservations.reduce((sum, r) => sum + r.party_size, 0),
    [filteredReservations],
  );

  const patchReservationTable = (reservationId: string, tableId: string | null) => {
    setPayload((prev) => {
      if (!prev) return prev;
      const table = tableId ? tables.find((t) => t.id === tableId) : null;
      return {
        ...prev,
        reservations: prev.reservations.map((r) =>
          r.id === reservationId
            ? {
                ...r,
                dining_table_id: tableId,
                table: table
                  ? {
                      id: table.id,
                      table_number: table.table_number,
                      table_name: table.table_name,
                    }
                  : null,
              }
            : r,
        ),
      };
    });
  };

  const patchReservationStatus = (reservationId: string, status: ReservationStatus) => {
    setPayload((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        reservations: prev.reservations.map((r) =>
          r.id === reservationId
            ? {
                ...r,
                status: {
                  id: status.id,
                  code: status.code,
                  name: status.name,
                  color_hex: status.color_hex,
                },
              }
            : r,
        ),
      };
    });
  };

  const removeFromOpen = (reservationId: string) => {
    setOpenReservations((prev) => prev.filter((r) => r.id !== reservationId));
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            open_count: Math.max(0, (prev.open_count ?? 0) - 1),
          }
        : prev,
    );
  };

  const setStatus = async (reservationId: string, status: ReservationStatus) => {
    setBusyId(reservationId);
    try {
      const res = await fetch(
        `/api/display/reservations/${encodeURIComponent(reservationId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status_id: status.id }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(
          DISPLAY_SESSION_ERRORS[data.error ?? ""] ??
            "Status konnte nicht geändert werden.",
        );
        return;
      }
      patchReservationStatus(reservationId, status);
      const previousCode =
        openReservations.find((r) => r.id === reservationId)?.status?.code ??
        payload?.reservations.find((r) => r.id === reservationId)?.status?.code ??
        "";
      if (payload?.restaurant_id) {
        dispatchReservationOpenResolvedLivePatch({
          restaurantId: payload.restaurant_id,
          reservationId,
          previousStatusCode: previousCode,
          nextStatusCode: status.code,
        });
      }
      if (status.code !== "pending" && status.code !== "change_requested") {
        removeFromOpen(reservationId);
      }
      toast.success(`Status: ${status.name}`);
      void load({ silent: true });
    } catch {
      toast.error("Status konnte nicht geändert werden.");
    } finally {
      setBusyId(null);
    }
  };

  const resolveChangeRequest = async (
    reservationId: string,
    action: "approve" | "decline",
  ) => {
    setBusyId(reservationId);
    try {
      const res = await fetch(
        `/api/display/reservations/${encodeURIComponent(reservationId)}/change-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action }),
        },
      );
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(
          data.message ??
            DISPLAY_SESSION_ERRORS[data.error ?? ""] ??
            "Änderungsanfrage konnte nicht bearbeitet werden.",
        );
        return;
      }
      removeFromOpen(reservationId);
      if (payload?.restaurant_id) {
        const row =
          openReservations.find((r) => r.id === reservationId) ?? null;
        dispatchReservationOpenResolvedLivePatch({
          restaurantId: payload.restaurant_id,
          reservationId,
          previousStatusCode: "change_requested",
          nextStatusCode:
            action === "approve"
              ? nextStatusCodeAfterChangeRequestApprove(statuses, row ?? {
                  status_before_change_id: null,
                })
              : nextStatusCodeAfterChangeRequestDecline(statuses, row ?? {
                  status_before_change_id: null,
                }),
        });
      }
      toast.success(
        action === "approve"
          ? "Änderung übernommen."
          : "Änderungsanfrage abgelehnt.",
      );
      void load({ silent: true });
    } catch {
      toast.error("Änderungsanfrage konnte nicht bearbeitet werden.");
    } finally {
      setBusyId(null);
    }
  };

  const overlapReservations = useMemo((): ReservationListRow[] => {
    return reservations.map((r) => ({
      id: r.id,
      restaurant_id: payload?.restaurant_id ?? "",
      reservation_number: r.reservation_number,
      guest_pin: "",
      created_at: "",
      created_by_profile_id: null,
      created_by_profile: null,
      guest_first_name: r.guest_first_name,
      guest_last_name: r.guest_last_name,
      guest_phone: r.guest_phone,
      guest_email: r.guest_email,
      contact_id: r.contact_id,
      party_size: r.party_size,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      dining_table_id: r.dining_table_id,
      dwell_minutes: null,
      notify_email: false,
      notify_whatsapp: false,
      terms_accepted: false,
      pending_change: null,
      status_before_change_id: null,
      reservation_statuses: r.status
        ? {
            id: r.status.id,
            code: r.status.code,
            name: r.status.name,
            color_hex: r.status.color_hex,
          }
        : null,
      dining_tables: r.table
        ? {
            id: r.table.id,
            table_number: r.table.table_number,
            table_name: r.table.table_name,
            area_id: tables.find((t) => t.id === r.table!.id)?.area_id ?? "",
          }
        : null,
    }));
  }, [reservations, payload?.restaurant_id, tables]);

  const seatedStatus = statuses.find((s) => s.code === "seated");
  const confirmedStatus = statuses.find((s) => s.code === "confirmed");
  const declinedStatus = statuses.find((s) => s.code === "declined");
  const completedStatus = statuses.find((s) => s.code === "completed");

  const renderListActions = (
    r: DisplayReservationRow,
    code: string | undefined,
    isBusy: boolean,
    compact: boolean,
  ) => {
    const iconBtnClass = compact
      ? "size-8 shrink-0 rounded-lg"
      : "size-11 shrink-0 rounded-xl";
    const btnClass = compact
      ? "h-8 min-w-[4.5rem] rounded-lg px-2 text-xs"
      : "h-12 min-w-[8rem] rounded-xl";
    return (
      <div
        className={cn("flex gap-1.5", compact ? "w-full flex-wrap" : "shrink-0 flex-col sm:flex-row")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconBtnClass}
          aria-label="Nachricht senden"
          disabled={isBusy}
          onClick={() => {
            if (!reservationHasContactChannel(r)) {
              toast.error(
                "Keine Kontaktmöglichkeit hinterlegt (Telefon oder E-Mail).",
              );
              return;
            }
            setMessageTarget(r);
          }}
        >
          <MessageSquare className={compact ? "size-3.5" : "size-4"} />
        </Button>
        {confirmedStatus &&
        code !== "confirmed" &&
        code !== "seated" &&
        code !== "completed" ? (
          <Button
            size={compact ? "sm" : "lg"}
            className={cn(btnClass, brandActionButtonRoundedClassName)}
            disabled={isBusy}
            onClick={() => void setStatus(r.id, confirmedStatus)}
          >
            {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : "Bestätigen"}
          </Button>
        ) : null}
        {declinedStatus && code === "pending" ? (
          <Button
            size={compact ? "sm" : "lg"}
            variant="outline"
            className={btnClass}
            disabled={isBusy}
            onClick={() => void setStatus(r.id, declinedStatus)}
          >
            Ablehnen
          </Button>
        ) : null}
        {seatedStatus && code !== "seated" && code !== "completed" ? (
          <Button
            size={compact ? "sm" : "lg"}
            variant="secondary"
            className={btnClass}
            disabled={isBusy}
            onClick={() => void setStatus(r.id, seatedStatus)}
          >
            Check-in
          </Button>
        ) : null}
        {completedStatus && code === "seated" ? (
          <Button
            size={compact ? "sm" : "lg"}
            variant="outline"
            className={btnClass}
            disabled={isBusy}
            onClick={() => void setStatus(r.id, completedStatus)}
          >
            Abschließen
          </Button>
        ) : null}
      </div>
    );
  };

  const renderListReservation = (r: DisplayReservationRow) => {
    const isBusy = busyId === r.id;
    const tableLabel = r.table ? formatDiningTableSelectLabel(r.table) : null;
    const startLabel = timeFmt.format(new Date(r.starts_at));
    const endLabel = timeFmt.format(new Date(r.ends_at));
    const code = r.status?.code;
    const guestName = `${r.guest_first_name} ${r.guest_last_name}`.trim();
    const hasListActions =
      (confirmedStatus &&
        code !== "confirmed" &&
        code !== "seated" &&
        code !== "completed") ||
      (declinedStatus && code === "pending") ||
      (seatedStatus && code !== "seated" && code !== "completed") ||
      (completedStatus && code === "seated");
    const tableField = (
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <DisplayReservationTableField
          reservation={r}
          tables={tables}
          reservations={reservations}
          disabled={isBusy}
          compact={listDensity === "compact"}
          onUpdated={(tableId) => patchReservationTable(r.id, tableId)}
        />
      </div>
    );

    const openEdit = () => setEditReservationId(r.id);

    if (listDensity === "compact") {
      return (
        <div
          key={r.id}
          role="button"
          tabIndex={0}
          className="flex h-full min-w-0 cursor-pointer flex-col rounded-xl border border-border/50 bg-card px-3 py-2.5 shadow-card transition-colors hover:bg-muted/20"
          onClick={openEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openEdit();
            }
          }}
        >
          <div className="flex min-w-0 items-start gap-2">
            <span className="w-11 shrink-0 text-base font-semibold tabular-nums leading-none">
              {startLabel}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span className="truncate font-semibold text-sm leading-snug">{guestName}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  #{r.reservation_number}
                </span>
                {r.status ? (
                  <span
                    className="shrink-0 rounded-full px-2 py-px text-[10px] font-medium text-white"
                    style={{ backgroundColor: r.status.color_hex }}
                  >
                    {r.status.name}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-[11px] text-muted-foreground">
                {r.party_size} P. · bis {endLabel}
                {tableLabel ? ` · ${tableLabel}` : ""}
              </p>
            </div>
          </div>
          {hasListActions ? (
            <div className="mt-2">{renderListActions(r, code, isBusy, true)}</div>
          ) : null}
          <div className="mt-2">{tableField}</div>
        </div>
      );
    }

    return (
      <div
        key={r.id}
        role="button"
        tabIndex={0}
        className="cursor-pointer rounded-2xl border border-border/50 bg-card p-4 shadow-card transition-colors hover:bg-muted/20"
        onClick={openEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openEdit();
          }
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">#{r.reservation_number}</span>
              <span className="text-2xl font-semibold tabular-nums">{startLabel}</span>
              {r.status ? (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: r.status.color_hex }}
                >
                  {r.status.name}
                </span>
              ) : null}
            </div>
            <p className="text-2xl font-semibold leading-tight">{guestName}</p>
            <p className="flex items-center gap-1 text-muted-foreground">
              <Users className="size-4" />
              {r.party_size} Personen · bis {endLabel}
              {tableLabel ? ` · ${tableLabel}` : ""}
            </p>
            {r.notes && !r.notes.startsWith("display-demo:") ? (
              <p className="text-sm text-muted-foreground">{r.notes}</p>
            ) : null}
            {tableField}
          </div>
          {renderListActions(r, code, isBusy, false)}
        </div>
      </div>
    );
  };

  const shiftSelectedDay = (deltaDays: number) => {
    const next = new Date(selectedDay);
    next.setDate(next.getDate() + deltaDays);
    setSelectedDayYmd(localDayToYmd(next));
  };

  const viewChip = (id: ViewMode, label: string, badge?: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setViewMode(id)}
      className={cn(
        "relative shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        viewMode === id
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border/60 bg-muted/30 text-muted-foreground",
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            "ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
            viewMode === id
              ? "bg-accent-foreground/15 text-accent-foreground"
              : "bg-amber-500/15 text-amber-800 dark:text-amber-200",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className={displayModuleContentClassName}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              aria-label="Vorheriger Tag"
              onClick={() => shiftSelectedDay(-1)}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <DatePickerField
              value={selectedDayYmd}
              onChange={(v) => {
                if (v) setSelectedDayYmd(v);
              }}
              size="compact"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-xl"
              aria-label="Nächster Tag"
              onClick={() => shiftSelectedDay(1)}
            >
              <ChevronRight className="size-5" />
            </Button>
            {!isSelectedToday ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => setSelectedDayYmd(localDayToYmd(new Date()))}
              >
                Heute
              </Button>
            ) : null}
          </div>
          <div>
            {isSelectedToday ? (
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Heute
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {formatDayHeadingDe(selectedDay)}
            </p>
            {showDataSkeleton ? (
              <div className="mt-2 flex flex-wrap gap-4">
                <Skeleton className="h-7 w-36 rounded-lg" />
                <Skeleton className="h-7 w-28 rounded-lg" />
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap gap-4 text-lg">
                <span>
                  <span className="font-semibold tabular-nums">
                    {payload?.stats.count ?? 0}
                  </span>{" "}
                  Reservierungen
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="size-5" />
                  <span className="font-semibold tabular-nums text-foreground">
                    {payload?.stats.guests ?? 0}
                  </span>{" "}
                  Gäste
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="lg"
            className={cn(modulePrimaryAddButtonClassName, "h-12 rounded-xl")}
            onClick={() => setCreateOpen(true)}
            disabled={showDataSkeleton}
          >
            <Plus className="mr-2 size-5" />
            Neu
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {viewChip("open", "Offen", openCount)}
        {viewChip("list", "Liste")}
        {viewChip("occupancy", "Tischbelegung")}
      </div>

      {viewMode === "open" ? (
        openLoading && openReservations.length === 0 ? (
          <div className="space-y-3" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : openReservations.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card px-4 py-10 text-center shadow-card">
            <p className="text-sm font-medium text-foreground">
              Keine offenen Reservierungen
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Unbestätigte Buchungen und Änderungsanfragen erscheinen hier.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {openReservations.map((r) => {
              const isBusy = busyId === r.id;
              const pending = r.pending_change;
              const changeHint =
                r.status?.code === "change_requested" && pending
                  ? formatDisplayChangeRequestHint(r, pending)
                  : null;
              return (
                <DisplayOpenReservationCard
                  key={r.id}
                  reservation={r}
                  busy={isBusy}
                  changeHint={changeHint}
                  onOpen={() => setEditReservationId(r.id)}
                  onConfirm={
                    confirmedStatus && r.status?.code === "pending"
                      ? () => void setStatus(r.id, confirmedStatus)
                      : undefined
                  }
                  onReject={
                    declinedStatus && r.status?.code === "pending"
                      ? () => void setStatus(r.id, declinedStatus)
                      : undefined
                  }
                  onApproveChange={
                    r.status?.code === "change_requested"
                      ? () => void resolveChangeRequest(r.id, "approve")
                      : undefined
                  }
                  onDeclineChange={
                    r.status?.code === "change_requested"
                      ? () => void resolveChangeRequest(r.id, "decline")
                      : undefined
                  }
                />
              );
            })}
          </div>
        )
      ) : showDataSkeleton ? (
        <>
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <div
            className={cn(
              listDensity === "compact"
                ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
                : "space-y-3",
            )}
            aria-busy
          >
            {Array.from({ length: listDensity === "compact" ? 6 : 4 }).map(
              (_, i) => (
                <Skeleton
                  key={i}
                  className={cn(
                    "w-full rounded-2xl",
                    listDensity === "compact" ? "h-20" : "h-24",
                  )}
                />
              ),
            )}
          </div>
        </>
      ) : (
        <>
      {slotMinutes.length > 1 ? (
        <DisplayTimeRangeSlider
          slotMinutes={slotMinutes}
          value={effectiveRangeSlotIndices}
          onChange={setRangeSlotIndices}
          hint={
            viewMode === "occupancy"
              ? "Tischbelegung: alle Reservierungen im gewählten Zeitraum"
              : "Liste: Überlappung im gewählten Zeitraum"
          }
        />
      ) : null}

      {slotMinutes.length > 0 ? (
        <DisplayPeriodStatsBar
          reservationCount={filteredReservations.length}
          guestCount={filteredGuestCount}
          freeTables={periodStats.freeTables}
          occupiedTables={periodStats.occupiedTables}
          freeSeats={periodStats.freeSeats}
          occupiedSeats={periodStats.occupiedSeats}
          totalSeats={periodStats.totalSeats}
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <AutoAssignTablesButton
          variant="display"
          size="default"
          className="h-9 w-full rounded-xl sm:w-auto"
          reservations={reservations.map((r) => ({
            id: r.id,
            party_size: r.party_size,
            starts_at: r.starts_at,
            ends_at: r.ends_at,
            dining_table_id: r.dining_table_id,
            reservation_statuses: r.status ? { code: r.status.code } : null,
          }))}
          tables={tables}
          onDone={() => void load({ silent: true })}
        />
        {viewMode === "list" ? (
          <div className="flex shrink-0 justify-end sm:justify-start">
            <div
              className="flex h-9 shrink-0 items-center gap-0.5 rounded-lg border border-border/50 bg-muted/20 p-0.5"
              role="group"
              aria-label="Listenansicht"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8 rounded-md",
                  listDensity === "comfortable" &&
                    "bg-background text-foreground shadow-sm",
                )}
                aria-label="Ausführliche Liste"
                aria-pressed={listDensity === "comfortable"}
                onClick={() => setListDensity("comfortable")}
              >
                <LayoutList className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8 rounded-md",
                  listDensity === "compact" &&
                    "bg-background text-foreground shadow-sm",
                )}
                aria-label="Kompakte Liste"
                aria-pressed={listDensity === "compact"}
                onClick={() => setListDensity("compact")}
              >
                <Rows3 className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {viewMode === "occupancy" ? (
        <div className="space-y-4">
          {areas.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto">
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedAreaId(a.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium",
                    selectedAreaId === a.id
                      ? "border-accent bg-accent/10 font-medium text-foreground"
                      : "border-border/50 bg-muted/30 text-muted-foreground",
                  )}
                >
                  {a.name}
                </button>
              ))}
            </div>
          ) : null}

          {tablesInArea.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Keine Tische hinterlegt.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {tablesInArea.map((t) => {
                const list = occupancy.get(t.id) ?? [];
                const label = formatDiningTableSelectLabel(t);
                const bg = list.length > 0 ? t.color_hex : undefined;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "rounded-xl border border-border/50 p-2.5 shadow-card",
                      list.length > 0 ? "text-white" : "bg-card min-h-[4.5rem]",
                    )}
                    style={
                      list.length > 0 && bg
                        ? { backgroundColor: bg }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <span className="shrink-0 rounded-full bg-black/10 px-1.5 py-px text-[10px] tabular-nums">
                        {t.capacity}
                      </span>
                    </div>
                    {list.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">frei</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-xs leading-snug">
                        {list.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              className="w-full truncate text-left tabular-nums underline-offset-2 hover:underline"
                              onClick={() => setEditReservationId(r.id)}
                            >
                              {timeFmt.format(new Date(r.starts_at))}–
                              {timeFmt.format(new Date(r.ends_at))} · #{r.reservation_number}{" "}
                              · {r.guest_last_name} ({r.party_size})
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            listDensity === "compact"
              ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
              : "space-y-3",
          )}
        >
          {filteredReservations.length === 0 ? (
            <p className="py-12 text-center text-lg text-muted-foreground">
              {reservations.length === 0
                ? isSelectedToday
                  ? "Heute keine Reservierungen."
                  : "Keine Reservierungen an diesem Tag."
                : "Keine Reservierungen in diesem Zeitraum."}
            </p>
          ) : (
            filteredReservations.map((r) => renderListReservation(r))
          )}
        </div>
      )}
        </>
      )}

      <DisplayReservationEditDrawer
        open={editReservationId !== null}
        onOpenChange={(open) => {
          if (!open) setEditReservationId(null);
        }}
        reservationId={editReservationId}
        statuses={statuses}
        tables={tables}
        reservations={overlapReservations}
        defaultDwellMinutes={payload?.default_dwell_minutes ?? 120}
        bookingTimeStepMinutes={bookingStep}
        onSaved={() => {
          void load({ silent: true });
          void loadOpen({ silent: true });
        }}
      />

      <DisplayReservationDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        statuses={statuses}
        tables={tables}
        defaultDwellMinutes={payload?.default_dwell_minutes ?? 120}
        bookingTimeStepMinutes={bookingStep}
        nextReservationNumber={payload?.next_reservation_number ?? null}
        onCreated={(row) => {
          if (row) applyOptimisticReservation(row);
          else void load({ silent: true });
        }}
      />

      <DisplayReservationMessageSheet
        open={messageTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMessageTarget(null);
        }}
        reservation={messageTarget}
        restaurantName={payload?.restaurant_name ?? null}
      />
    </div>
  );
}
