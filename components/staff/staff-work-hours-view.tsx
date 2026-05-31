"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StaffWorkHoursSkeleton } from "@/components/staff/staff-work-hours-skeleton";
import { StaffWorkEntryDrawer } from "@/components/staff/staff-work-entry-drawer";
import {
  daysInclusive,
  exclusiveUtcIsoAfterLocalVisibleEnd,
  formatDayHeadingDe,
  formatMonthTitleDe,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import {
  deleteStaffWorkEntry,
  fetchStaffWorkEntriesInRange,
} from "@/lib/supabase/staff-db";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { RestaurantStaffRow, RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { summarizeStaffWorkEntries } from "@/lib/staff/staff-work-hours-summary";
import {
  displayShiftBounds,
  groupWorkHoursDayEntries,
  isDisplayWorkEntry,
} from "@/lib/staff/staff-work-hours-display";
import {
  STAFF_SUMMARY_LOGGED_COLOR,
  STAFF_WORK_ENTRY_LABELS,
  staffDisplayName,
} from "@/lib/types/staff";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

const selectValueNoShrink =
  "[&_[data-slot=select-value]]:!min-w-0 [&_[data-slot=select-value]]:!shrink-0 [&_[data-slot=select-value]]:!grow-0 [&_[data-slot=select-value]]:overflow-visible [&_[data-slot=select-value]]:whitespace-nowrap";

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

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

type StaffWorkHoursViewProps = {
  restaurantId: string;
  staff: RestaurantStaffRow;
  staffId: string;
  allowEdit?: boolean;
};

export function StaffWorkHoursView({
  restaurantId,
  staff,
  staffId,
  allowEdit = true,
}: StaffWorkHoursViewProps) {
  const { cursor, setMonth, setYear, prevMonth, nextMonth } = useMonthCursor();
  const [entries, setEntries] = useState<RestaurantStaffWorkEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<RestaurantStaffWorkEntryRow | null>(
    null,
  );
  const [dayForNew, setDayForNew] = useState<Date | null>(null);

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

  useEffect(() => {
    void reload();
  }, [reload]);

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

  const today = useMemo(() => startOfLocalDay(new Date()), []);
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
  const monthTitle = formatMonthTitleDe(cursor.year, cursor.month);

  return (
    <div className="pb-16">
      {loading && !showSkeleton ? (
        <div className="min-h-[28rem]" aria-busy="true" />
      ) : null}
      {showSkeleton ? (
        <StaffWorkHoursSkeleton />
      ) : (
        <>
          <Card className="mb-4 border-border/50 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Zusammenfassung — {staffDisplayName(staff)}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
                  Arbeitszeit:{" "}
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
            </CardContent>
          </Card>

          <Card className="mb-4 border-border/50 shadow-card">
            <CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-center text-sm font-medium tracking-tight sm:text-left">
                {monthTitle}
              </p>
              <div className="flex shrink-0 items-center justify-center gap-1">
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
                  items={GERMAN_MONTH_ITEMS}
                  onValueChange={(v) => {
                    if (typeof v === "string") setMonth(Number.parseInt(v, 10));
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    className={appSelectTriggerAccentCn(
                      "h-9 min-h-9 min-w-[9.5rem] max-w-[12rem] shrink-0 rounded-xl px-2.5 text-left text-sm font-normal",
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
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {monthDays.map((day) => {
              const key = localDayKey(day);
              const dayEntries = byDay.get(key) ?? [];
              return (
                <Card key={key} className="border-border/50 shadow-card">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-base">
                      {formatDayHeadingDe(day)}
                    </CardTitle>
                    {allowEdit ? (
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
                      groupWorkHoursDayEntries(dayEntries).map((item) => {
                        if (item.kind === "display_shift") {
                          const bounds = displayShiftBounds(item.segments);
                          const endLabel = bounds.isOpen
                            ? "läuft"
                            : timeDe.format(new Date(bounds.endsAt!));
                          const breakCount = item.segments.filter(
                            (s) => s.entry_type === "break",
                          ).length;
                          return (
                            <div
                              key={item.shiftId}
                              className="flex w-full items-start gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm"
                            >
                              <StaffWorkEntryTypeStripe
                                type="work"
                                className="mt-0.5 self-stretch"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="font-medium">
                                  Display-Schicht
                                  {bounds.isOpen ? (
                                    <span className="ml-1.5 text-xs font-normal text-accent">
                                      (läuft)
                                    </span>
                                  ) : null}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                                  {timeDe.format(new Date(bounds.startsAt))} –{" "}
                                  {endLabel}
                                  {breakCount > 0
                                    ? ` · ${breakCount} Pause${breakCount === 1 ? "" : "n"}`
                                    : ""}
                                </span>
                              </span>
                            </div>
                          );
                        }

                        const e = item.entry;
                        const endInstant = e.is_open ? new Date() : new Date(e.ends_at);
                        const endLabel = e.is_open
                          ? "läuft"
                          : timeDe.format(endInstant);
                        const row = (
                          <>
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
                              </span>
                              <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                                {timeDe.format(new Date(e.starts_at))} – {endLabel}
                              </span>
                            </span>
                          </>
                        );

                        if (!allowEdit || e.is_open || isDisplayWorkEntry(e)) {
                          return (
                            <div
                              key={e.id}
                              className="flex w-full items-start gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm"
                            >
                              {row}
                            </div>
                          );
                        }

                        return (
                          <button
                            key={e.id}
                            type="button"
                            className="flex w-full items-start gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-sm hover:bg-muted/40"
                            onClick={() => {
                              setEditEntry(e);
                              setDayForNew(null);
                              setDrawerOpen(true);
                            }}
                          >
                            {row}
                          </button>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {allowEdit ? (
            <StaffWorkEntryDrawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              restaurantId={restaurantId}
              staffId={staffId}
              entry={editEntry}
              defaultDay={dayForNew}
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
          ) : null}
        </>
      )}
    </div>
  );
}
