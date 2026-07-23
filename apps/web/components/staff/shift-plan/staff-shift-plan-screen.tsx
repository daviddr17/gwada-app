"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { DataExportSheet } from "@/components/export/data-export-sheet";
import { Button } from "@/components/ui/button";
import {
  AppFullscreenOverlay,
  appFullscreenOverlayScrollClassName,
} from "@/components/ui/app-fullscreen-overlay";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ShiftPlanCopyDialog } from "@/components/staff/shift-plan/shift-plan-copy-dialog";
import { ShiftPlanGrid, ShiftPlanMonthView } from "@/components/staff/shift-plan/shift-plan-grid";
import { ShiftPlanPeriodSummaryBar } from "@/components/staff/shift-plan/shift-plan-period-summary-bar";
import { ShiftPlanSettingsDialog } from "@/components/staff/shift-plan/shift-plan-settings-dialog";
import { ShiftPlanShiftDrawer } from "@/components/staff/shift-plan/shift-plan-shift-drawer";
import { ShiftPlanTemplateDrawer } from "@/components/staff/shift-plan/shift-plan-template-drawer";
import { ShiftPlanShiftCard } from "@/components/staff/shift-plan/shift-plan-shift-card";
import { StaffShiftPlanSkeleton } from "@/components/staff/shift-plan/staff-shift-plan-skeleton";
import {
  ShiftPlanTemplatePalette,
  parseShiftPlanDropId,
  type ShiftPlanDragData,
} from "@/components/staff/shift-plan/shift-plan-template-palette";
import { ShiftPlanSearchField } from "@/components/staff/shift-plan/shift-plan-search-field";
import { ShiftPlanToolbar } from "@/components/staff/shift-plan/shift-plan-toolbar";
import { StaffFormDrawer } from "@/components/staff/staff-form-drawer";
import {
  buildShiftScheduleExportRows,
  downloadShiftScheduleCsv,
  downloadShiftSchedulePdf,
} from "@/lib/staff/export-shift-schedule";
import {
  applyTemplateTimesToDay,
  daysInView,
  formatViewTitleDe,
  localDayKey,
  navigateAnchor,
  parseLocalDayKey,
  viewRangeUtcIso,
} from "@/lib/staff/shift-schedule-range";
import {
  clockTimesFromScheduledShift,
  findOverlappingScheduledShift,
  formatShiftPlanWeekApplyToast,
} from "@/lib/staff/shift-plan-overlap";
import { ensureRestaurantOwnerStaffClient } from "@/lib/staff/ensure-owner-staff-client";
import { fetchStaffForRestaurant, fetchStaffContractsForRestaurant, fetchStaffWorkEntriesInRange, deleteStaffWorkEntry, upsertStaffWorkEntry } from "@/lib/supabase/staff-db";
import {
  createScheduledShiftsBatch,
  deleteScheduledShift,
  fetchScheduledShiftsInRange,
  fetchShiftScheduleSettings,
  fetchShiftTemplates,
  updateScheduledShift,
} from "@/lib/supabase/staff-shift-schedule-db";
import { fetchStaffAvailabilitySlotsForRestaurant } from "@/lib/supabase/staff-availability-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useShiftPlanWeatherByDate } from "@/lib/hooks/use-shift-plan-weather-by-date";
import { usePublicHolidaysByDate } from "@/lib/hooks/use-public-holidays-by-date";
import { useStaffPositionTagsStorage } from "@/lib/hooks/use-staff-position-tags-storage";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { RestaurantStaffRow, RestaurantStaffContractRow, RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { staffDisplayName, STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";
import type {
  RestaurantShiftTemplateRow,
  RestaurantStaffScheduledShiftRow,
  ShiftScheduleSortKey,
  ShiftScheduleViewMode,
} from "@/lib/types/staff-shift-schedule";
import type { RestaurantStaffAvailabilitySlotRow } from "@/lib/types/staff-availability";
import { scheduledShiftDurationMinutes } from "@/lib/types/staff-shift-schedule";
import { STAFF_CONTRACTS_UPDATED_EVENT } from "@/lib/staff/staff-contract-events";
import {
  absenceEntryRangeForLocalDay,
  findStaffAbsenceOnDay,
  isShiftPlanAbsenceEntry,
  SHIFT_PLAN_ABSENCE_PRESETS,
} from "@/lib/staff/shift-plan-absence";
import { computeShiftPlanPeriodSummary } from "@/lib/staff/shift-plan-period-summary";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { moduleTableFullscreenToggleButtonClassName } from "@/lib/ui/module-paginated-data-table";
import { cn } from "@/lib/utils";
import {
  parseRestaurantYmdKey,
  restaurantZonedDateKey,
  utcInstantForRestaurantLocal,
} from "@/lib/restaurant/restaurant-timezone";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";

type StaffShiftPlanScreenProps = {
  /** Nur eigene Schichten (Profil-Ansicht). */
  personalMode?: boolean;
  personalStaffId?: string | null;
};

export function StaffShiftPlanScreen({
  personalMode = false,
  personalStaffId = null,
}: StaffShiftPlanScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const positionTags = useStaffPositionTagsStorage(restaurantId);

  const [view, setView] = useState<ShiftScheduleViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [staffRows, setStaffRows] = useState<RestaurantStaffRow[]>([]);
  const [templates, setTemplates] = useState<RestaurantShiftTemplateRow[]>([]);
  const [shifts, setShifts] = useState<RestaurantStaffScheduledShiftRow[]>([]);
  const [absenceEntries, setAbsenceEntries] = useState<RestaurantStaffWorkEntryRow[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<
    RestaurantStaffAvailabilitySlotRow[]
  >([]);
  const [contracts, setContracts] = useState<RestaurantStaffContractRow[]>([]);
  const [requiresAcceptance, setRequiresAcceptance] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [rangeFetching, setRangeFetching] = useState(false);
  const showSkeleton = useDeferredSkeleton(bootstrapping);
  const shiftsRequestIdRef = useRef(0);

  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState(
    personalMode && personalStaffId ? personalStaffId : "all",
  );
  const [sortKey, setSortKey] = useState<ShiftScheduleSortKey>("name");
  const [onlyWithShifts, setOnlyWithShifts] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editShift, setEditShift] = useState<RestaurantStaffScheduledShiftRow | null>(
    null,
  );
  const [defaultStaffId, setDefaultStaffId] = useState<string | null>(null);
  const [defaultDay, setDefaultDay] = useState<Date | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [planFullscreen, setPlanFullscreen] = useState(false);
  const [staffDrawerOpen, setStaffDrawerOpen] = useState(false);
  const [editStaffMember, setEditStaffMember] =
    useState<RestaurantStaffRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false);
  const [templateDrawerMode, setTemplateDrawerMode] = useState<"create" | "edit">(
    "create",
  );
  const [editTemplate, setEditTemplate] = useState<RestaurantShiftTemplateRow | null>(
    null,
  );

  useEffect(() => {
    const newParam = searchParams.get("new");
    if (!newParam) return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("new");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    if (newParam === "template") {
      setTemplateDrawerMode("create");
      setEditTemplate(null);
      setTemplateDrawerOpen(true);
      return;
    }
    if (newParam === "1") {
      setEditShift(null);
      setDefaultStaffId(null);
      setDefaultDay(new Date());
      setDrawerOpen(true);
    }
  }, [searchParams, router, pathname]);

  useEffect(() => {
    const dayParam = searchParams.get("day");
    if (!dayParam) return;
    const parsed = parseRestaurantYmdKey(dayParam);
    if (!parsed) return;
    setAnchor(
      utcInstantForRestaurantLocal(
        parsed.year,
        parsed.month,
        parsed.day,
        12,
        0,
        restaurantTimeZone,
      ),
    );
    setView("day");
    const p = new URLSearchParams(searchParams.toString());
    p.delete("day");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, router, pathname, restaurantTimeZone]);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [shiftToDelete, setShiftToDelete] =
    useState<RestaurantStaffScheduledShiftRow | null>(null);
  const [absenceToDelete, setAbsenceToDelete] =
    useState<RestaurantStaffWorkEntryRow | null>(null);

  const days = useMemo(() => daysInView(anchor, view), [anchor, view]);
  const range = useMemo(() => viewRangeUtcIso(anchor, view), [anchor, view]);
  const anchorWeekDays = useMemo(
    () => (view === "week" ? daysInView(anchor, "week") : days),
    [anchor, days, view],
  );

  const targetSummaryDays = useMemo(
    () => (view === "week" ? anchorWeekDays : days),
    [view, anchorWeekDays, days],
  );

  const holidayRange = useMemo(() => {
    const first = days[0];
    const last = days[days.length - 1];
    if (!first || !last) return { from: "", to: "" };
    return { from: localDayKey(first), to: localDayKey(last) };
  }, [days]);
  const { byDate: holidaysByDate } = usePublicHolidaysByDate(
    restaurantId,
    holidayRange.from,
    holidayRange.to,
  );

  const weatherDayKeys = useMemo(
    () => days.map((d) => localDayKey(d)),
    [days],
  );
  const { weatherByDate } = useShiftPlanWeatherByDate(
    weatherDayKeys,
    !bootstrapping && workspaceReady && !!restaurantId,
  );

  const fetchShiftsForRange = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!restaurantId) return;
    const requestId = ++shiftsRequestIdRef.current;
    const quiet = opts?.quiet === true;
    if (!quiet) setRangeFetching(true);
    try {
      const staffScope =
        personalMode && personalStaffId ? personalStaffId : null;
      const [shiftsRes, absencesRes, availabilityRes] = await Promise.all([
        fetchScheduledShiftsInRange(
          restaurantId,
          range.rangeStart,
          range.rangeEnd,
          staffScope ? { staffId: staffScope } : undefined,
        ),
        fetchStaffWorkEntriesInRange(
          restaurantId,
          staffScope,
          range.rangeStart,
          range.rangeEnd,
        ),
        fetchStaffAvailabilitySlotsForRestaurant(
          restaurantId,
          staffScope ? { staffId: staffScope } : undefined,
        ),
      ]);
      if (requestId !== shiftsRequestIdRef.current) return;
      if (shiftsRes.error) toast.error(shiftsRes.error);
      else setShifts(shiftsRes.data);
      if (absencesRes.error) toast.error(absencesRes.error);
      else {
        setAbsenceEntries(absencesRes.data.filter(isShiftPlanAbsenceEntry));
      }
      if (availabilityRes.error) toast.error(availabilityRes.error);
      else setAvailabilitySlots(availabilityRes.data);
    } finally {
      // Auch nach quiet-Reload zurücksetzen, falls zuvor ein sichtbarer Fetch die Dim aktiviert hat.
      if (requestId === shiftsRequestIdRef.current) {
        setRangeFetching(false);
      }
    }
  }, [
    restaurantId,
    range.rangeStart,
    range.rangeEnd,
    personalMode,
    personalStaffId,
  ]);

  useEffect(() => {
    if (!restaurantId) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;
    setBootstrapping(true);

    void (async () => {
      await ensureRestaurantOwnerStaffClient(restaurantId);
      if (cancelled) return;
      const [staffRes, templateRes, settingsRes, contractsRes] =
        await Promise.all([
          fetchStaffForRestaurant(restaurantId),
          fetchShiftTemplates(restaurantId),
          fetchShiftScheduleSettings(restaurantId),
          fetchStaffContractsForRestaurant(restaurantId),
        ]);
      if (cancelled) return;

      if (staffRes.error) toast.error(staffRes.error);
      if (templateRes.error) toast.error(templateRes.error);
      if (contractsRes.error) toast.error(contractsRes.error);

      setStaffRows(staffRes.data.filter((s) => s.is_active));
      setTemplates(templateRes.data);
      setRequiresAcceptance(settingsRes.data?.requires_acceptance ?? false);
      setContracts(contractsRes.data);
      setBootstrapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, personalMode, personalStaffId]);

  useEffect(() => {
    if (!restaurantId || bootstrapping) return;
    void fetchShiftsForRange();
  }, [restaurantId, bootstrapping, fetchShiftsForRange]);

  const reload = useCallback(
    async (opts?: { quiet?: boolean }) => {
      await fetchShiftsForRange(opts);
    },
    [fetchShiftsForRange],
  );

  const reloadStaffRows = useCallback(async () => {
    if (!restaurantId) return;
    await ensureRestaurantOwnerStaffClient(restaurantId);
    const { data, error } = await fetchStaffForRestaurant(restaurantId);
    if (error) toast.error(error);
    else setStaffRows(data.filter((s) => s.is_active));
  }, [restaurantId]);

  const openStaffMember = useCallback((staff: RestaurantStaffRow) => {
    setEditStaffMember(staff);
    setStaffDrawerOpen(true);
  }, []);

  const activePositionTags = useMemo(
    () => positionTags.items.filter((t) => t.active),
    [positionTags.items],
  );

  const reloadTemplatesAndShifts = useCallback(async () => {
    if (!restaurantId || bootstrapping) return;
    const requestId = ++shiftsRequestIdRef.current;
    setRangeFetching(true);
    try {
      const [templateRes, shiftsRes] = await Promise.all([
        fetchShiftTemplates(restaurantId),
        fetchScheduledShiftsInRange(
          restaurantId,
          range.rangeStart,
          range.rangeEnd,
          personalMode && personalStaffId ? { staffId: personalStaffId } : undefined,
        ),
      ]);
      if (requestId !== shiftsRequestIdRef.current) return;
      if (templateRes.error) toast.error(templateRes.error);
      if (shiftsRes.error) toast.error(shiftsRes.error);
      setTemplates(templateRes.data);
      setShifts(shiftsRes.data);
    } finally {
      if (requestId === shiftsRequestIdRef.current) {
        setRangeFetching(false);
      }
    }
  }, [
    restaurantId,
    bootstrapping,
    range.rangeStart,
    range.rangeEnd,
    personalMode,
    personalStaffId,
  ]);

  useEffect(() => {
    if (!restaurantId) return;
    const refreshContracts = () => {
      void fetchStaffContractsForRestaurant(restaurantId).then((res) => {
        if (res.error) return;
        setContracts(res.data);
      });
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refreshContracts();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshContracts);
    window.addEventListener(STAFF_CONTRACTS_UPDATED_EVENT, refreshContracts);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshContracts);
      window.removeEventListener(STAFF_CONTRACTS_UPDATED_EVENT, refreshContracts);
    };
  }, [restaurantId]);

  const filteredStaff = useMemo(() => {
    let list = staffRows.filter((s) => s.is_active);
    if (personalMode && personalStaffId) {
      list = list.filter((s) => s.id === personalStaffId);
    } else if (staffFilter !== "all") {
      list = list.filter((s) => s.id === staffFilter);
    }
    if (positionFilter !== "all") {
      list = list.filter((s) => s.position_tag_id === positionFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        staffDisplayName(s).toLowerCase().includes(q),
      );
    }

    if (onlyWithShifts) {
      const dayKeys = new Set(days.map((day) => localDayKey(day)));
      const staffWithShift = new Set<string>();
      for (const shift of shifts) {
        if (shift.status === "declined") continue;
        if (!dayKeys.has(localDayKey(new Date(shift.starts_at)))) continue;
        staffWithShift.add(shift.staff_id);
      }
      list = list.filter((s) => staffWithShift.has(s.id));
    }

    const minutesByStaff = new Map<string, number>();
    for (const shift of shifts) {
      const min = scheduledShiftDurationMinutes(shift.starts_at, shift.ends_at);
      minutesByStaff.set(
        shift.staff_id,
        (minutesByStaff.get(shift.staff_id) ?? 0) + min,
      );
    }

    list.sort((a, b) => {
      if (sortKey === "hours") {
        return (
          (minutesByStaff.get(b.id) ?? 0) - (minutesByStaff.get(a.id) ?? 0) ||
          staffDisplayName(a).localeCompare(staffDisplayName(b), "de")
        );
      }
      return staffDisplayName(a).localeCompare(staffDisplayName(b), "de");
    });
    return list;
  }, [
    staffRows,
    personalMode,
    personalStaffId,
    staffFilter,
    positionFilter,
    search,
    sortKey,
    shifts,
    onlyWithShifts,
    days,
  ]);

  const visibleShifts = useMemo(() => {
    const ids = new Set(filteredStaff.map((s) => s.id));
    return shifts.filter((s) => ids.has(s.staff_id));
  }, [shifts, filteredStaff]);

  const visibleAbsences = useMemo(() => {
    const ids = new Set(filteredStaff.map((s) => s.id));
    return absenceEntries.filter((e) => ids.has(e.staff_id));
  }, [absenceEntries, filteredStaff]);

  const visibleAvailabilitySlots = useMemo(() => {
    const ids = new Set(filteredStaff.map((s) => s.id));
    return availabilitySlots.filter((slot) => ids.has(slot.staff_id));
  }, [availabilitySlots, filteredStaff]);

  const periodSummary = useMemo(
    () =>
      computeShiftPlanPeriodSummary({
        shifts: visibleShifts,
        contracts,
        visibleDays: days,
      }),
    [visibleShifts, contracts, days],
  );

  const staffOptions = useMemo(
    () =>
      staffRows
        .filter((s) => s.is_active)
        .map((s) => ({ id: s.id, label: staffDisplayName(s) })),
    [staffRows],
  );

  const staffById = useMemo(
    () => new Map(staffRows.map((s) => [s.id, s])),
    [staffRows],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    if (!restaurantId || personalMode) return;
    const drop = event.over;
    if (!drop) return;

    const dropData = parseShiftPlanDropId(String(drop.id));
    if (!dropData) return;

    const dragData = event.active.data.current as ShiftPlanDragData | undefined;
    if (!dragData) return;

    const targetDays: { dayKey: string; day: Date }[] =
      dropData.kind === "week"
        ? days.map((day) => ({ dayKey: localDayKey(day), day }))
        : [
            {
              dayKey: dropData.dayKey,
              day: parseLocalDayKey(dropData.dayKey),
            },
          ];
    const staffId = dropData.staffId;
    const multiDay = targetDays.length > 1;

    if (dragData.type === "shift") {
      const shift = shifts.find((s) => s.id === dragData.shiftId);
      if (!shift) return;
      const clock = clockTimesFromScheduledShift(shift);

      if (multiDay) {
        let skippedAbsence = 0;
        let skippedOverlap = 0;
        const toCreate = [];
        for (const { dayKey, day } of targetDays) {
          if (findStaffAbsenceOnDay(absenceEntries, staffId, dayKey)) {
            skippedAbsence += 1;
            continue;
          }
          const times = applyTemplateTimesToDay(
            day,
            clock.startTime,
            clock.endTime,
          );
          if (
            findOverlappingScheduledShift(times, shifts, {
              staffId,
              dayKey,
            })
          ) {
            skippedOverlap += 1;
            continue;
          }
          toCreate.push({
            restaurantId,
            staffId,
            startsAt: times.startsAt,
            endsAt: times.endsAt,
            templateId: shift.template_id,
            label: shift.label,
            status: (requiresAcceptance ? "pending" : "confirmed") as
              | "pending"
              | "confirmed",
          });
        }

        const feedback = formatShiftPlanWeekApplyToast({
          created: toCreate.length,
          skippedAbsence,
          skippedOverlap,
          multiDay: true,
        });
        if (toCreate.length === 0) {
          toast.error(feedback.message);
          return;
        }

        const { data: createdRows, error } =
          await createScheduledShiftsBatch(toCreate);
        if (error || createdRows.length === 0) {
          toast.error(error ?? "Schicht konnte nicht geplant werden.");
          return;
        }

        setShifts((prev) => [...prev, ...createdRows]);
        const finalFeedback = formatShiftPlanWeekApplyToast({
          created: createdRows.length,
          skippedAbsence,
          skippedOverlap,
          multiDay: true,
        });
        if (finalFeedback.type === "info") toast.info(finalFeedback.message);
        else toast.success(finalFeedback.message);
        void reload({ quiet: true });
        return;
      }

      const { dayKey, day } = targetDays[0]!;
      const existingAbsence = findStaffAbsenceOnDay(
        absenceEntries,
        staffId,
        dayKey,
      );
      if (existingAbsence) {
        toast.error(
          `An diesem Tag ist ${STAFF_WORK_ENTRY_LABELS[existingAbsence.entry_type]} eingetragen.`,
        );
        return;
      }
      const oldStart = new Date(shift.starts_at);
      const oldEnd = new Date(shift.ends_at);
      const durationMs = oldEnd.getTime() - oldStart.getTime();
      const newStart = applyTemplateTimesToDay(
        day,
        clock.startTime,
        clock.endTime,
      );
      const starts = new Date(newStart.startsAt);
      const ends = new Date(starts.getTime() + durationMs);
      const moveTimes = {
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
      };
      if (
        findOverlappingScheduledShift(moveTimes, shifts, {
          staffId,
          dayKey,
          excludeShiftId: shift.id,
        })
      ) {
        toast.error("Zu dieser Zeit gibt es bereits eine Schicht.");
        return;
      }
      const { error } = await updateScheduledShift({
        id: shift.id,
        staffId,
        startsAt: moveTimes.startsAt,
        endsAt: moveTimes.endsAt,
        status: requiresAcceptance ? "pending" : shift.status,
      });
      if (error) toast.error(error);
      else void reload();
      return;
    }

    if (dragData.type === "template") {
      const template = templates.find((t) => t.id === dragData.templateId);
      if (!template) return;

      let skippedAbsence = 0;
      let skippedOverlap = 0;
      const toCreate = [];
      for (const { dayKey, day } of targetDays) {
        if (findStaffAbsenceOnDay(absenceEntries, staffId, dayKey)) {
          skippedAbsence += 1;
          continue;
        }
        const times = applyTemplateTimesToDay(
          day,
          template.start_time,
          template.end_time,
        );
        if (
          findOverlappingScheduledShift(times, shifts, {
            staffId,
            dayKey,
          })
        ) {
          skippedOverlap += 1;
          continue;
        }
        toCreate.push({
          restaurantId,
          staffId,
          startsAt: times.startsAt,
          endsAt: times.endsAt,
          templateId: template.id,
          label: null as string | null,
          status: (requiresAcceptance ? "pending" : "confirmed") as
            | "pending"
            | "confirmed",
        });
      }

      const feedback = formatShiftPlanWeekApplyToast({
        created: toCreate.length,
        skippedAbsence,
        skippedOverlap,
        multiDay,
      });
      if (toCreate.length === 0) {
        toast.error(feedback.message);
        return;
      }

      const { data: createdRows, error } =
        await createScheduledShiftsBatch(toCreate);
      if (error || createdRows.length === 0) {
        toast.error(error ?? "Schicht konnte nicht geplant werden.");
        return;
      }

      setShifts((prev) => [...prev, ...createdRows]);
      const finalFeedback = formatShiftPlanWeekApplyToast({
        created: createdRows.length,
        skippedAbsence,
        skippedOverlap,
        multiDay,
      });
      if (finalFeedback.type === "info") toast.info(finalFeedback.message);
      else toast.success(finalFeedback.message);
      void reload({ quiet: true });
      return;
    }

    if (dragData.type === "absence") {
      let skippedSame = 0;
      let skippedOther = 0;
      let skippedShifts = 0;
      const createJobs: Array<() => Promise<{ id: string } | null>> = [];

      for (const { dayKey, day } of targetDays) {
        const existing = findStaffAbsenceOnDay(
          absenceEntries,
          staffId,
          dayKey,
        );
        if (existing) {
          if (existing.entry_type === dragData.entryType) skippedSame += 1;
          else skippedOther += 1;
          continue;
        }

        const hasShiftsOnDay = shifts.some(
          (s) =>
            s.staff_id === staffId &&
            localDayKey(new Date(s.starts_at)) === dayKey,
        );
        if (hasShiftsOnDay) {
          skippedShifts += 1;
          continue;
        }

        const rangeTimes = absenceEntryRangeForLocalDay(day);
        createJobs.push(() =>
          upsertStaffWorkEntry(restaurantId, staffId, {
            entry_type: dragData.entryType,
            starts_at: rangeTimes.starts_at,
            ends_at: rangeTimes.ends_at,
            note: null,
          }),
        );
      }

      if (createJobs.length === 0) {
        if (!multiDay) {
          if (skippedSame > 0) {
            toast.info(
              `${STAFF_WORK_ENTRY_LABELS[dragData.entryType]} ist für diesen Tag bereits eingetragen.`,
            );
          } else if (skippedOther > 0) {
            toast.error("Für diesen Tag ist bereits eine Abwesenheit eingetragen.");
          } else if (skippedShifts > 0) {
            toast.error(
              "Bitte zuerst geplante Schichten an diesem Tag entfernen.",
            );
          } else {
            toast.error("Eintrag konnte nicht gespeichert werden.");
          }
          return;
        }
        toast.error(
          "Keine Tage belegt — Abwesenheit oder geplante Schichten blockieren.",
        );
        return;
      }

      const results = await Promise.all(createJobs.map((job) => job()));
      const created = results.filter(Boolean).length;
      if (created === 0) {
        toast.error("Eintrag konnte nicht gespeichert werden.");
        return;
      }

      if (multiDay) {
        const skipped = skippedSame + skippedOther + skippedShifts;
        const skipHint =
          skipped > 0
            ? ` · ${skipped} Tag${skipped === 1 ? "" : "e"} übersprungen`
            : "";
        toast.success(
          `${STAFF_WORK_ENTRY_LABELS[dragData.entryType]}: ${created} Tag${created === 1 ? "" : "e"}.${skipHint}`,
        );
      } else {
        toast.success(
          `${STAFF_WORK_ENTRY_LABELS[dragData.entryType]} eingetragen.`,
        );
      }
      void reload({ quiet: multiDay });
    }
  };

  const openNew = (staffId?: string, day?: Date) => {
    setEditShift(null);
    setDefaultStaffId(staffId ?? null);
    setDefaultDay(day ?? null);
    setDrawerOpen(true);
  };

  const openEdit = (shift: RestaurantStaffScheduledShiftRow) => {
    setEditShift(shift);
    setDrawerOpen(true);
  };

  const openDeleteShift = (shift: RestaurantStaffScheduledShiftRow) => {
    setShiftToDelete(shift);
  };

  const confirmDeleteShift = useCallback(async () => {
    if (!shiftToDelete) return;
    const { error } = await deleteScheduledShift(shiftToDelete.id);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Schicht gelöscht.");
    setShiftToDelete(null);
    if (editShift?.id === shiftToDelete.id) {
      setDrawerOpen(false);
      setEditShift(null);
    }
    void reload();
  }, [shiftToDelete, editShift?.id, reload]);

  const openDeleteAbsence = (entry: RestaurantStaffWorkEntryRow) => {
    setAbsenceToDelete(entry);
  };

  const confirmDeleteAbsence = useCallback(async () => {
    if (!absenceToDelete) return;
    const ok = await deleteStaffWorkEntry(absenceToDelete.id);
    if (!ok) {
      toast.error("Eintrag konnte nicht gelöscht werden.");
      return;
    }
    toast.success("Eintrag entfernt.");
    setAbsenceToDelete(null);
    void reload();
  }, [absenceToDelete, reload]);

  const openCreateTemplate = () => {
    setTemplateDrawerMode("create");
    setEditTemplate(null);
    setTemplateDrawerOpen(true);
  };

  const openEditTemplate = (template: RestaurantShiftTemplateRow) => {
    setTemplateDrawerMode("edit");
    setEditTemplate(template);
    setTemplateDrawerOpen(true);
  };

  const templateNextSortOrder = useMemo(
    () =>
      templates.reduce((max, t) => Math.max(max, t.sort_order), -1) + 1,
    [templates],
  );

  const closePlanFullscreen = useCallback(() => setPlanFullscreen(false), []);

  const activeDragShift =
    activeDragId?.startsWith("shift-")
      ? shifts.find((s) => `shift-${s.id}` === activeDragId) ?? null
      : null;

  const activeDragTemplate =
    activeDragId?.startsWith("template-")
      ? templates.find((t) => `template-${t.id}` === activeDragId) ?? null
      : null;

  if (!workspaceReady) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  if (bootstrapping && !showSkeleton) {
    return <div className="min-h-[24rem]" aria-busy="true" />;
  }
  if (showSkeleton) return <StaffShiftPlanSkeleton />;

  const activeDragAbsence =
    activeDragId?.startsWith("absence-")
      ? SHIFT_PLAN_ABSENCE_PRESETS.find(
          (p) => `absence-${p.entryType}` === activeDragId,
        ) ?? null
      : null;

  const editable = !personalMode;
  const referenceDay = days[0] ?? anchor;
  const periodTitle = formatViewTitleDe(anchor, view);

  const shiftPlanToolbar = (showExpandFullscreen: boolean) =>
    !personalMode ? (
      <ShiftPlanToolbar
        view={view}
        onViewChange={setView}
        anchor={anchor}
        onPrev={() => setAnchor((a) => navigateAnchor(a, view, -1))}
        onNext={() => setAnchor((a) => navigateAnchor(a, view, 1))}
        onToday={() => setAnchor(new Date())}
        positionFilter={positionFilter}
        onPositionFilterChange={setPositionFilter}
        positionTags={positionTags.items}
        staffFilter={staffFilter}
        onStaffFilterChange={setStaffFilter}
        staffOptions={staffOptions}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        onlyWithShifts={onlyWithShifts}
        onOnlyWithShiftsChange={setOnlyWithShifts}
        onCopy={() => setCopyOpen(true)}
        onExport={() => setExportOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onExpandFullscreen={
          showExpandFullscreen ? () => setPlanFullscreen(true) : undefined
        }
      />
    ) : (
      <ShiftPlanToolbar
        view={view}
        onViewChange={setView}
        anchor={anchor}
        onPrev={() => setAnchor((a) => navigateAnchor(a, view, -1))}
        onNext={() => setAnchor((a) => navigateAnchor(a, view, 1))}
        onToday={() => setAnchor(new Date())}
        positionFilter="all"
        onPositionFilterChange={() => {}}
        positionTags={[]}
        staffFilter="all"
        onStaffFilterChange={() => {}}
        staffOptions={[]}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        onlyWithShifts={onlyWithShifts}
        onOnlyWithShiftsChange={setOnlyWithShifts}
        onCopy={() => {}}
        onExport={() => setExportOpen(true)}
        onSettings={() => {}}
        management={false}
        onExpandFullscreen={
          showExpandFullscreen ? () => setPlanFullscreen(true) : undefined
        }
      />
    );

  const shiftPlanBody = (
    <div
      className={cn(
        "space-y-4 transition-opacity duration-200 ease-out",
        rangeFetching && "pointer-events-none opacity-60",
      )}
      aria-busy={rangeFetching}
    >
      <div className="space-y-2">
        <ShiftPlanPeriodSummaryBar summary={periodSummary} />
        {editable ? (
          <>
            <Button
              type="button"
              size="lg"
              className={modulePrimaryAddButtonFullWidthClassName}
              onClick={() => openNew()}
            >
              <Plus className="size-4" />
              Schicht
            </Button>
            <ShiftPlanSearchField value={search} onChange={setSearch} />
          </>
        ) : null}
      </div>

      {editable && !planFullscreen ? (
        <ShiftPlanTemplatePalette
          templates={templates}
          referenceDay={referenceDay}
          onCreateTemplate={openCreateTemplate}
          onEditTemplate={openEditTemplate}
          sticky
        />
      ) : null}

      {view === "month" ? (
        <ShiftPlanMonthView
          days={days}
          staffRows={filteredStaff}
          positionTags={positionTags.items}
          shifts={visibleShifts}
          absenceEntries={visibleAbsences}
          availabilitySlots={visibleAvailabilitySlots}
          restaurantTimeZone={restaurantTimeZone}
          holidaysByDate={holidaysByDate}
          weatherByDate={weatherByDate}
          contracts={contracts}
          targetSummaryDays={targetSummaryDays}
          viewMode={view}
          onAddShift={openNew}
          onEditShift={openEdit}
          onDeleteShift={openDeleteShift}
          onDeleteAbsence={openDeleteAbsence}
          onStaffClick={editable ? openStaffMember : undefined}
          editable={editable}
        />
      ) : (
        <ShiftPlanGrid
          days={days}
          staffRows={filteredStaff}
          positionTags={positionTags.items}
          shifts={visibleShifts}
          absenceEntries={visibleAbsences}
          availabilitySlots={visibleAvailabilitySlots}
          restaurantTimeZone={restaurantTimeZone}
          holidaysByDate={holidaysByDate}
          weatherByDate={weatherByDate}
          contracts={contracts}
          targetSummaryDays={targetSummaryDays}
          viewMode={view}
          hoursSummaryDayKeys={
            view === "week"
              ? anchorWeekDays.map((d) => restaurantZonedDateKey(d, restaurantTimeZone))
              : undefined
          }
          onPrevWeek={() => setAnchor((a) => navigateAnchor(a, view, -1))}
          onNextWeek={() => setAnchor((a) => navigateAnchor(a, view, 1))}
          periodNav={view === "week" ? "week" : "day"}
          onAddShift={openNew}
          onEditShift={openEdit}
          onDeleteShift={openDeleteShift}
          onDeleteAbsence={openDeleteAbsence}
          onStaffClick={editable ? openStaffMember : undefined}
          editable={editable}
          weekDropEnabled={editable && view === "week" && days.length > 1}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {!planFullscreen ? shiftPlanToolbar(true) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        {!planFullscreen ? shiftPlanBody : null}

        <AppFullscreenOverlay
          open={planFullscreen}
          onClose={closePlanFullscreen}
          aria-label="Schichtplan"
          header={
            <div className="flex flex-col gap-3 px-4 py-3">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    Schichtplan
                  </p>
                  <p className="truncate text-sm text-muted-foreground tabular-nums">
                    {periodTitle}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={moduleTableFullscreenToggleButtonClassName}
                        onClick={closePlanFullscreen}
                        aria-label="Vollbild schließen"
                      />
                    }
                  >
                    <Minimize2 className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="top">Vollbild schließen</TooltipContent>
                </Tooltip>
              </div>
              {shiftPlanToolbar(false)}
              {editable ? (
                <ShiftPlanTemplatePalette
                  templates={templates}
                  referenceDay={referenceDay}
                  onCreateTemplate={openCreateTemplate}
                  onEditTemplate={openEditTemplate}
                  className="mt-1"
                />
              ) : null}
            </div>
          }
        >
          {planFullscreen ? (
            <div className={cn(appFullscreenOverlayScrollClassName, "px-4 pb-4")}>
              {shiftPlanBody}
            </div>
          ) : null}
        </AppFullscreenOverlay>

        <DragOverlay dropAnimation={null}>
          {activeDragShift ? (
            <ShiftPlanShiftCard shift={activeDragShift} draggable={false} />
          ) : activeDragTemplate ? (
            <div
              className="inline-flex min-w-[7.5rem] flex-col rounded-lg border px-2.5 py-1.5 text-left shadow-md"
              style={{
                borderColor: `${activeDragTemplate.color}55`,
                backgroundColor: `${activeDragTemplate.color}12`,
              }}
            >
              <span className="truncate text-xs font-medium">
                {activeDragTemplate.name}
              </span>
            </div>
          ) : activeDragAbsence ? (
            <div
              className="inline-flex min-w-[7.5rem] flex-col rounded-lg border px-2.5 py-1.5 text-left shadow-md"
              style={{
                borderColor: `${activeDragAbsence.color}55`,
                backgroundColor: `${activeDragAbsence.color}12`,
              }}
            >
              <span className="truncate text-xs font-medium">
                {activeDragAbsence.label}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {filteredStaff.length === 0 && !bootstrapping ? (
        <p className="text-sm text-muted-foreground">
          Keine Mitarbeiter für die aktuelle Filterauswahl.
        </p>
      ) : null}

      {editable ? (
        <>
          <ShiftPlanShiftDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            restaurantId={restaurantId}
            staffRows={staffRows}
            templates={templates}
            existingShifts={shifts}
            shift={editShift}
            defaultStaffId={defaultStaffId}
            defaultDay={defaultDay}
            requiresAcceptance={requiresAcceptance}
            onSaved={() => void reload()}
          />
          <ShiftPlanSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            restaurantId={restaurantId}
            requiresAcceptance={requiresAcceptance}
            onSaved={setRequiresAcceptance}
          />
          <ShiftPlanCopyDialog
            open={copyOpen}
            onOpenChange={setCopyOpen}
            restaurantId={restaurantId}
            anchor={anchor}
            view={view}
            requiresAcceptance={requiresAcceptance}
            onCopied={() => void reload()}
          />
          <StaffFormDrawer
            open={staffDrawerOpen}
            onOpenChange={setStaffDrawerOpen}
            mode="edit"
            restaurantId={restaurantId}
            staff={editStaffMember}
            activePositionTags={activePositionTags}
            onSaved={() => void reloadStaffRows()}
          />
          <ShiftPlanTemplateDrawer
            open={templateDrawerOpen}
            onOpenChange={setTemplateDrawerOpen}
            mode={templateDrawerMode}
            restaurantId={restaurantId}
            template={editTemplate}
            nextSortOrder={templateNextSortOrder}
            onSaved={() => void reloadTemplatesAndShifts()}
          />
        </>
      ) : null}

      <DataExportSheet
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Schichtplan exportieren"
        description={`${visibleShifts.length} Schichten im sichtbaren Zeitraum.`}
        itemCount={visibleShifts.length}
        onCsv={() => {
          const rows = buildShiftScheduleExportRows(visibleShifts, staffById);
          downloadShiftScheduleCsv(
            rows,
            `schichtplan-${localDayKey(anchor)}`,
          );
          setExportOpen(false);
        }}
        onPdf={() => {
          const rows = buildShiftScheduleExportRows(visibleShifts, staffById);
          void downloadShiftSchedulePdf(
            rows,
            `Schichtplan · ${formatViewTitleDe(anchor, view)}`,
            `schichtplan-${localDayKey(anchor)}`,
          );
          setExportOpen(false);
        }}
      />

      {editable ? (
        <>
          <ConfirmDialog
            open={shiftToDelete != null}
            onOpenChange={(open) => {
              if (!open) setShiftToDelete(null);
            }}
            title="Schicht löschen?"
            description="Die geplante Schicht wird dauerhaft entfernt."
            confirmLabel="Löschen"
            destructive
            onConfirm={() => confirmDeleteShift()}
          />
          <ConfirmDialog
            open={absenceToDelete != null}
            onOpenChange={(open) => {
              if (!open) setAbsenceToDelete(null);
            }}
            title="Abwesenheit entfernen?"
            description="Der Eintrag wird aus den Arbeitszeiten gelöscht."
            confirmLabel="Löschen"
            destructive
            onConfirm={() => confirmDeleteAbsence()}
          />
        </>
      ) : null}
    </div>
  );
}
