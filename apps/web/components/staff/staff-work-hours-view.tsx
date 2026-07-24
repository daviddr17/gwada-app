"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCssVarElementHeight } from "@/lib/hooks/use-css-var-element-height";
import {
  STAFF_MODULE_STICKY_BAR_H_VAR,
  STAFF_WORK_HOURS_MONTH_BAR_H_VAR,
} from "@/lib/staff/staff-sticky-chrome";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StaffCollapsibleCard } from "@/components/staff/staff-collapsible-card";
import { StaffWorkHoursSkeleton } from "@/components/staff/staff-work-hours-skeleton";
import { StaffWorkEntryDrawer } from "@/components/staff/staff-work-entry-drawer";
import { StaffWageAdvancesSection } from "@/components/staff/staff-wage-advances-section";
import {
  daysInclusive,
  exclusiveUtcIsoAfterLocalVisibleEnd,
  formatDayHeadingDe,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import {
  deleteStaffWorkEntry,
  fetchStaffContractsForRestaurant,
  fetchStaffWorkEntriesInRange,
} from "@/lib/supabase/staff-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  RestaurantStaffWorkEntryRow,
} from "@/lib/types/staff";
import {
  entryDurationHours,
  formatWorkTimeRangeWithHoursDe,
  summarizeStaffWorkEntries,
} from "@/lib/staff/staff-work-hours-summary";
import {
  computeStaffPeriodPayrollLines,
  computeStaffPeriodWageSummary,
  formatStaffAvgHourlyWage,
  formatStaffEuroCents,
} from "@/lib/staff/staff-day-wage";
import { useStaffModuleSelectionOptional } from "@/lib/contexts/staff-module-selection-context";
import { StaffDisplayShiftRow } from "@/components/staff/staff-display-shift-row";
import {
  groupWorkHoursDayEntries,
  isDisplayWorkEntry,
} from "@/lib/staff/staff-work-hours-display";
import {
  findStaffAbsenceOnDay,
  isShiftPlanAbsenceEntry,
} from "@/lib/staff/shift-plan-absence";
import {
  STAFF_SUMMARY_LOGGED_COLOR,
  STAFF_WORK_ENTRY_LABELS,
  staffFamilyFirstDisplayName,
} from "@/lib/types/staff";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  moduleDataTableHeadCellClassName,
  moduleDataTableHeadRowClassName,
  moduleDataTableShellClassName,
} from "@/lib/ui/module-data-table";
import { cn } from "@/lib/utils";
import { STAFF_CONTRACTS_UPDATED_EVENT } from "@/lib/staff/staff-contract-events";
import { GWADA_STAFF_DATA_REFRESH_EVENT } from "@/lib/staff/staff-live-events";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Select-Wert nicht in die Chevron-Zelle quetschen (Basis-Trigger: grow/basis-0). */
const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:!basis-auto [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

const GERMAN_MONTH_ITEMS = Object.fromEntries(
  Array.from({ length: 12 }, (_, m) => [
    String(m),
    new Intl.DateTimeFormat("de-DE", { month: "long" }).format(
      new Date(2000, m, 1),
    ),
  ]),
);

function useMonthCursor() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  return {
    cursor,
    setMonth: (month: number) => setCursor((c) => ({ ...c, month })),
    setYear: (year: number) => setCursor((c) => ({ ...c, year })),
    goToMonth: (year: number, month: number) => setCursor({ year, month }),
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

function workHoursDayDomId(dayKey: string): string {
  return `staff-work-hours-day-${dayKey}`;
}

function scrollToWorkHoursDay(dayKey: string): void {
  document
    .getElementById(workHoursDayDomId(dayKey))
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

type StaffWorkHoursViewProps = {
  restaurantId: string;
  staff?: RestaurantStaffRow | null;
  staffId?: string | null;
  allowEdit?: boolean;
};

export function StaffWorkHoursView({
  restaurantId,
  staff = null,
  staffId = null,
  allowEdit = true,
}: StaffWorkHoursViewProps) {
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const staffSelection = useStaffModuleSelectionOptional();
  const staffList = staffSelection?.staffList ?? [];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { cursor, setMonth, setYear, goToMonth, prevMonth, nextMonth } =
    useMonthCursor();
  const pendingScrollToTodayRef = useRef(false);
  const monthStickyRef = useRef<HTMLDivElement>(null);
  useCssVarElementHeight(monthStickyRef, STAFF_WORK_HOURS_MONTH_BAR_H_VAR);
  const [entries, setEntries] = useState<RestaurantStaffWorkEntryRow[]>([]);
  const [contracts, setContracts] = useState<RestaurantStaffContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<RestaurantStaffWorkEntryRow | null>(
    null,
  );
  const [dayForNew, setDayForNew] = useState<Date | null>(null);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setEditEntry(null);
    setDayForNew(startOfLocalDay(new Date()));
    setDrawerOpen(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete("new");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const monthStart = useMemo(
    () => startOfLocalDay(new Date(cursor.year, cursor.month, 1)),
    [cursor.year, cursor.month],
  );
  const monthEnd = useMemo(
    () => startOfLocalDay(new Date(cursor.year, cursor.month + 1, 0)),
    [cursor.year, cursor.month],
  );

  const monthDays = useMemo(
    () => daysInclusive(monthStart, monthEnd),
    [monthStart, monthEnd],
  );

  const rangeStart = useMemo(() => {
    const d = monthDays[0];
    return d ? localDayStartToUtcIso(d) : new Date().toISOString();
  }, [monthDays]);

  const rangeEnd = useMemo(() => {
    const d = monthDays[monthDays.length - 1];
    return d
      ? exclusiveUtcIsoAfterLocalVisibleEnd(d)
      : new Date().toISOString();
  }, [monthDays]);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchStaffWorkEntriesInRange(
      restaurantId,
      staffId,
      rangeStart,
      rangeEnd,
    );
    setLoading(false);
    if (error) toast.error(error);
    else setEntries(data);
  }, [restaurantId, staffId, rangeStart, rangeEnd]);

  const reloadContracts = useCallback(async () => {
    const { data, error } = await fetchStaffContractsForRestaurant(restaurantId);
    if (error) toast.error(error);
    else setContracts(data);
  }, [restaurantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void reloadContracts();
  }, [reloadContracts]);

  useEffect(() => {
    const onContractsChanged = () => {
      void reloadContracts();
    };
    window.addEventListener(STAFF_CONTRACTS_UPDATED_EVENT, onContractsChanged);
    window.addEventListener(GWADA_STAFF_DATA_REFRESH_EVENT, onContractsChanged);
    return () => {
      window.removeEventListener(
        STAFF_CONTRACTS_UPDATED_EVENT,
        onContractsChanged,
      );
      window.removeEventListener(
        GWADA_STAFF_DATA_REFRESH_EVENT,
        onContractsChanged,
      );
    };
  }, [reloadContracts]);

  const byDay = useMemo(() => {
    const map = new Map<string, RestaurantStaffWorkEntryRow[]>();
    for (const e of entries) {
      const k = dayKeyFromIso(e.starts_at);
      const list = map.get(k) ?? [];
      list.push(e);
      map.set(k, list);
    }
    return map;
  }, [entries]);

  const summary = useMemo(
    () => summarizeStaffWorkEntries(entries, new Date()),
    [entries],
  );

  const wageSummary = useMemo(
    () =>
      computeStaffPeriodWageSummary({
        entries,
        contracts,
        periodStart: monthStart,
        periodEnd: monthEnd,
        now: new Date(),
      }),
    [entries, contracts, monthStart, monthEnd],
  );

  const payrollLines = useMemo(
    () =>
      computeStaffPeriodPayrollLines({
        entries,
        contracts,
        periodStart: monthStart,
        periodEnd: monthEnd,
        now: new Date(),
      }),
    [entries, contracts, monthStart, monthEnd],
  );

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of staffList) {
      map.set(row.id, staffFamilyFirstDisplayName(row));
    }
    return map;
  }, [staffList]);

  const payrollWageTotalCents = useMemo(
    () => payrollLines.reduce((sum, line) => sum + line.wageCents, 0),
    [payrollLines],
  );

  const drawerStaffId = editEntry?.staff_id ?? staffId ?? null;

  const absenceByDayKeyForDrawer = useMemo(() => {
    if (!drawerStaffId) return undefined;
    const map = new Map<string, "vacation" | "sick">();
    for (const e of entries) {
      if (e.staff_id !== drawerStaffId) continue;
      if (!isShiftPlanAbsenceEntry(e)) continue;
      map.set(dayKeyFromIso(e.starts_at), e.entry_type);
    }
    return map;
  }, [entries, drawerStaffId]);

  const today = useMemo(() => startOfLocalDay(new Date()), []);
  const todayKey = useMemo(() => localDayKey(today), [today]);
  const viewingCurrentMonth =
    cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  useEffect(() => {
    if (!pendingScrollToTodayRef.current || !viewingCurrentMonth) return;
    if (showSkeleton) return;
    pendingScrollToTodayRef.current = false;
    const id = window.requestAnimationFrame(() => {
      scrollToWorkHoursDay(todayKey);
    });
    return () => window.cancelAnimationFrame(id);
  }, [viewingCurrentMonth, todayKey, monthDays, showSkeleton]);

  const goToToday = useCallback(() => {
    if (!viewingCurrentMonth) {
      pendingScrollToTodayRef.current = true;
      goToMonth(today.getFullYear(), today.getMonth());
      return;
    }
    scrollToWorkHoursDay(todayKey);
  }, [viewingCurrentMonth, goToMonth, today, todayKey]);

  const yearMin = today.getFullYear() - 1;
  const yearMax = today.getFullYear() + 2;
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
  const openEntry = useCallback((e: RestaurantStaffWorkEntryRow) => {
    setEditEntry(e);
    setDayForNew(null);
    setDrawerOpen(true);
  }, []);

  const openDisplayShift = useCallback(
    (segments: RestaurantStaffWorkEntryRow[]) => {
      const primary =
        segments.find((s) => s.entry_type === "work") ?? segments[0];
      if (primary) openEntry(primary);
    },
    [openEntry],
  );

  const entryRowClassName =
    "flex w-full items-start gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45";
  /** Kein eigener Border — der Display-Schicht-Container ist der sichtbare Rahmen. */
  const displayShiftRowClassName =
    "group flex w-full flex-col gap-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45";

  const siblingEntries = useMemo(() => {
    if (!drawerOpen || !drawerStaffId) return [];
    const day = editEntry
      ? startOfLocalDay(new Date(editEntry.starts_at))
      : dayForNew
        ? startOfLocalDay(dayForNew)
        : null;
    if (!day) return [];
    const dayEntries = (byDay.get(localDayKey(day)) ?? []).filter(
      (e) => e.staff_id === drawerStaffId,
    );
    const openElsewhere = entries.filter(
      (e) =>
        e.staff_id === drawerStaffId &&
        e.is_open &&
        e.entry_type === "work" &&
        localDayKey(new Date(e.starts_at)) !== localDayKey(day),
    );
    return [...dayEntries, ...openElsewhere];
  }, [drawerOpen, editEntry, dayForNew, byDay, entries, drawerStaffId]);

  return (
    <div className="pb-16">
      {loading && !showSkeleton ? (
        <div className="min-h-[28rem]" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <StaffWorkHoursSkeleton />
      ) : (
        <>
          <div
            ref={monthStickyRef}
            style={{
              top: `var(${STAFF_MODULE_STICKY_BAR_H_VAR}, 4.75rem)`,
            }}
            className={cn(
              "sticky z-20 -mx-4 mb-4 border-b border-border/50 bg-app-chrome px-4 py-1.5 sm:-mx-6 sm:px-6 sm:py-2.5",
              "transition-[padding,top] duration-200 ease-out",
              "supports-[backdrop-filter]:bg-app-chrome/95 supports-[backdrop-filter]:backdrop-blur",
            )}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-2.5">
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 rounded-lg transition-[width,height] duration-200 ease-out sm:size-9"
                  onClick={prevMonth}
                  aria-label="Vorheriger Monat"
                >
                  <ChevronLeft className="size-4 sm:size-5" />
                </Button>
                <Select
                  value={String(cursor.month)}
                  items={GERMAN_MONTH_ITEMS}
                  onValueChange={(v) => {
                    if (typeof v === "string") setMonth(Number.parseInt(v, 10));
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className={appSelectTriggerAccentCn(
                      "h-8 min-h-8 min-w-[8.25rem] max-w-[11rem] shrink-0 rounded-xl px-2 text-left text-sm font-normal transition-[height,min-height,min-width] duration-200 ease-out sm:h-9 sm:min-h-9 sm:min-w-[9.5rem] sm:max-w-[12rem] sm:px-2.5",
                      selectValueNoShrink,
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, m) => (
                      <SelectItem key={m} value={String(m)}>
                        {GERMAN_MONTH_ITEMS[String(m)]}
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
                      // Jahr + Chevron brauchen mehr als 4.25rem — sonst liegt „Heute“ über dem Pfeil.
                      "h-8 min-h-8 min-w-[5.75rem] w-auto shrink-0 rounded-xl px-2.5 text-left text-sm font-normal tabular-nums transition-[height,min-height] duration-200 ease-out sm:h-9 sm:min-h-9 sm:min-w-[6.25rem] sm:px-3",
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
                  className="size-8 shrink-0 rounded-lg transition-[width,height] duration-200 ease-out sm:size-9"
                  onClick={nextMonth}
                  aria-label="Nächster Monat"
                >
                  <ChevronRight className="size-4 sm:size-5" />
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto h-7 shrink-0 rounded-full border-green-500/35 bg-green-500/10 px-2.5 text-xs font-medium text-green-800 transition-[height,padding,font-size] duration-200 ease-out hover:bg-green-500/15 hover:text-green-900 sm:ml-0 sm:h-8 sm:px-3 sm:text-sm dark:text-green-200 dark:hover:text-green-100"
                onClick={goToToday}
              >
                Heute
              </Button>
            </div>
          </div>

          <StaffCollapsibleCard
            title={
              staff
                ? `Zusammenfassung — ${staffFamilyFirstDisplayName(staff)}`
                : "Zusammenfassung — Alle Mitarbeiter"
            }
            defaultOpen={false}
            collapsedSummary={
              <span className="tabular-nums">
                Netto {summary.netWorkH.toFixed(1)} h · Lohn{" "}
                {formatStaffEuroCents(wageSummary.totalWageCents)}
              </span>
            }
          >
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <p className="flex items-center gap-2">
                <StaffWorkEntryTypeStripe
                  color={STAFF_SUMMARY_LOGGED_COLOR}
                  className="h-4 self-center"
                />
                <span>
                  Eingeloggt:{" "}
                  <span className="font-medium tabular-nums">
                    {summary.loggedH.toFixed(1)} h
                  </span>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <StaffWorkEntryTypeStripe
                  type="break"
                  className="h-4 self-center"
                />
                <span>
                  Pause:{" "}
                  <span className="font-medium tabular-nums">
                    {summary.breakH.toFixed(1)} h
                  </span>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <StaffWorkEntryTypeStripe
                  type="work"
                  className="h-4 self-center"
                />
                <span>
                  Netto-Arbeitszeit:{" "}
                  <span className="font-medium tabular-nums">
                    {summary.netWorkH.toFixed(1)} h
                  </span>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <StaffWorkEntryTypeStripe
                  type="vacation"
                  className="h-4 self-center"
                />
                <span>
                  Urlaub:{" "}
                  <span className="font-medium tabular-nums">
                    {summary.vacationDays}
                  </span>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <StaffWorkEntryTypeStripe
                  type="sick"
                  className="h-4 self-center"
                />
                <span>
                  Krank:{" "}
                  <span className="font-medium tabular-nums">
                    {summary.sickDays}
                  </span>
                </span>
              </p>
              <p>
                Lohn:{" "}
                <span className="font-medium tabular-nums">
                  {formatStaffEuroCents(wageSummary.totalWageCents)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Erfasste Zeiten × Vertragslohn
                </span>
              </p>
              {summary.sickDays > 0 ? (
                <p>
                  Kranklohn:{" "}
                  <span className="font-medium tabular-nums">
                    {wageSummary.sickPayCents > 0
                      ? formatStaffEuroCents(wageSummary.sickPayCents)
                      : "—"}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {wageSummary.sickPayCents > 0
                      ? `${wageSummary.sickDaysWithPay} Kranktag${wageSummary.sickDaysWithPay === 1 ? "" : "e"} × Soll-Tag (Woche ÷ 7)`
                      : "Festlohn oder Soll-Stunden im Vertrag fehlen"}
                  </span>
                </p>
              ) : null}
              {!staffId ? (
                <p>
                  Ø Stundenlohn:{" "}
                  <span className="font-medium tabular-nums">
                    {formatStaffAvgHourlyWage(
                      wageSummary.actualAvgHourlyWageCents,
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {wageSummary.totalWageCents > 0
                      ? `${formatStaffEuroCents(wageSummary.totalWageCents)} ÷ ${wageSummary.totalNetWorkHours.toFixed(1).replace(".", ",")} h`
                      : "Gesamtlohn ÷ Netto-Stunden"}
                  </span>
                </p>
              ) : null}
            </div>
          </StaffCollapsibleCard>

          <StaffCollapsibleCard
            title="Abrechnung"
            defaultOpen={false}
            collapsedSummary={
              payrollLines.length === 0 ? (
                <span>Keine erfassten Arbeitszeiten</span>
              ) : (
                <span className="tabular-nums">
                  {payrollLines.length} Mitarbeiter · Summe{" "}
                  {formatStaffEuroCents(payrollWageTotalCents)}
                </span>
              )
            }
          >
            {payrollLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Im gewählten Monat sind keine Arbeitszeiten erfasst.
              </p>
            ) : (
              <div className={cn(moduleDataTableShellClassName, "ring-1 ring-border/40")}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead>
                      <tr className={moduleDataTableHeadRowClassName}>
                        <th className={moduleDataTableHeadCellClassName}>
                          Name
                        </th>
                        <th
                          className={cn(
                            moduleDataTableHeadCellClassName,
                            "text-right",
                          )}
                        >
                          Eingeloggt
                        </th>
                        <th
                          className={cn(
                            moduleDataTableHeadCellClassName,
                            "text-right",
                          )}
                        >
                          Pause
                        </th>
                        <th
                          className={cn(
                            moduleDataTableHeadCellClassName,
                            "text-right",
                          )}
                        >
                          Netto
                        </th>
                        <th
                          className={cn(
                            moduleDataTableHeadCellClassName,
                            "text-right",
                          )}
                        >
                          Lohn
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollLines.map((line) => {
                        const name =
                          staffNameById.get(line.staffId) ?? "Mitarbeiter";
                        const canSelect =
                          Boolean(staffSelection) && !staffId;
                        return (
                          <tr
                            key={line.staffId}
                            className={cn(
                              "border-b border-border/40 last:border-0",
                              canSelect &&
                                "cursor-pointer hover:bg-muted/40",
                            )}
                            onClick={
                              canSelect
                                ? () =>
                                    staffSelection?.setSelectedStaffId(
                                      line.staffId,
                                    )
                                : undefined
                            }
                          >
                            <td className="px-4 py-2.5">
                              <span className="font-medium">{name}</span>
                              {line.note ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {line.note}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {line.loggedH.toFixed(1)} h
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {line.breakH.toFixed(1)} h
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {line.netWorkH.toFixed(1)} h
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                              {line.wageCents > 0
                                ? formatStaffEuroCents(line.wageCents)
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {staffId ? (
              <StaffWageAdvancesSection
                restaurantId={restaurantId}
                staffId={staffId}
                paidOnFromYmd={localDayKey(monthStart)}
                paidOnToYmd={localDayKey(monthEnd)}
                wageCents={payrollWageTotalCents}
                allowEdit={allowEdit}
              />
            ) : null}
          </StaffCollapsibleCard>

          <div className="space-y-3">
            {monthDays.map((day) => {
              const key = localDayKey(day);
              const isToday = key === todayKey;
              const dayEntries = byDay.get(key) ?? [];
              const canAddEntry = Boolean(staffId);
              const blockNewTimeEntry = staffId
                ? findStaffAbsenceOnDay(entries, staffId, key) != null
                : false;
              return (
                <Card
                  key={key}
                  id={workHoursDayDomId(key)}
                  style={{
                    scrollMarginTop: `calc(var(${STAFF_MODULE_STICKY_BAR_H_VAR}, 4.75rem) + var(${STAFF_WORK_HOURS_MONTH_BAR_H_VAR}, 3rem) + 0.5rem)`,
                  }}
                  className={cn(
                    "border-border/50 shadow-card",
                    isToday && "ring-1 ring-green-500/25 dark:ring-green-400/20",
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <div className="min-w-0 space-y-0.5">
                      {isToday ? (
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                          Heute
                        </p>
                      ) : null}
                      <CardTitle className="text-base">
                        {formatDayHeadingDe(day)}
                      </CardTitle>
                    </div>
                    {allowEdit && canAddEntry && !blockNewTimeEntry ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Eintrag hinzufügen"
                        onClick={() => {
                          setEditEntry(null);
                          setDayForNew(day);
                          setDrawerOpen(true);
                        }}
                      >
                        <Plus className="size-4" />
                      </Button>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dayEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground">—</p>
                    ) : (
                      groupWorkHoursDayEntries(
                        dayEntries,
                        !staffId ? { staffNameById: staffNameById } : undefined,
                      ).map((item) => {
                        if (item.kind === "display_shift") {
                          const shiftStaffId =
                            item.segments.find((s) => s.entry_type === "work")
                              ?.staff_id ?? item.segments[0]?.staff_id;
                          const shiftStaffLabel = shiftStaffId
                            ? staffNameById.get(shiftStaffId)
                            : undefined;
                          return (
                            <button
                              key={item.shiftId}
                              type="button"
                              className={displayShiftRowClassName}
                              onClick={() => openDisplayShift(item.segments)}
                            >
                              {!staffId && shiftStaffLabel ? (
                                <p className="px-0.5 text-xs text-muted-foreground">
                                  {shiftStaffLabel}
                                </p>
                              ) : null}
                              <StaffDisplayShiftRow
                                segments={item.segments}
                                timeZone={restaurantTimeZone}
                              />
                            </button>
                          );
                        }

                        const e = item.entry;
                        const entryStaffId = e.staff_id;
                        const endInstant = e.is_open ? new Date() : new Date(e.ends_at);
                        const endLabel = e.is_open
                          ? "läuft"
                          : timeDe.format(endInstant);
                        const entryStaffLabel = staffNameById.get(entryStaffId);

                        return (
                          <button
                            key={e.id}
                            type="button"
                            className={entryRowClassName}
                            onClick={() => openEntry(e)}
                          >
                            <StaffWorkEntryTypeStripe
                              type={e.entry_type}
                              className="mt-0.5 self-stretch"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">
                                {STAFF_WORK_ENTRY_LABELS[e.entry_type]}
                                {isDisplayWorkEntry(e) ? (
                                  <span className="ml-1.5 text-xs font-normal text-accent">
                                    (Display)
                                  </span>
                                ) : null}
                                {!staffId && entryStaffLabel ? (
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    · {entryStaffLabel}
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                                {formatWorkTimeRangeWithHoursDe(
                                  `${timeDe.format(new Date(e.starts_at))} – ${endLabel}`,
                                  e.is_open ? null : entryDurationHours(e),
                                )}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <StaffWorkEntryDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            restaurantId={restaurantId}
            staffId={editEntry?.staff_id ?? staffId ?? ""}
            entry={editEntry}
            defaultDay={dayForNew}
            absenceByDayKey={absenceByDayKeyForDrawer}
            allowEdit={allowEdit}
            siblingEntries={siblingEntries}
            onSaved={() => void reload()}
            onDelete={async (id) => {
              const ok = await deleteStaffWorkEntry(id);
              if (!ok) toast.error("Löschen fehlgeschlagen.");
              else {
                toast.success("Gelöscht");
                void reload();
              }
            }}
          />
        </>
      )}
    </div>
  );
}
