"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardCalendarDaySheet } from "@/components/dashboard/dashboard-calendar-day-sheet";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DASHBOARD_CALENDAR_WEEKDAY_LABELS,
  formatMonthTitleDe,
  restaurantMonthKey,
  shiftMonthKey,
  weekdayIndexMondayFirst,
} from "@/lib/dashboard/dashboard-calendar-month";
import {
  dashboardCalendarDayHasSignals,
  type DashboardCalendarDaySummary,
} from "@/lib/dashboard/dashboard-calendar-types";
import { useDashboardCalendarSummary } from "@/lib/hooks/use-dashboard-calendar-summary";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { PRIVATE_EVENT_STRIPE_HEX } from "@/lib/reservations/reservation-kind";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { cn } from "@/lib/utils";

const DOT = {
  reservations: "var(--accent)",
  events: PRIVATE_EVENT_STRIPE_HEX,
  staff: "#64748b",
  news: "#059669",
  holiday: "#d97706",
  hours: "#ea580c",
} as const;

function DayDots({ day }: { day: DashboardCalendarDaySummary }) {
  const dots: string[] = [];
  if (day.reservationCount > 0) dots.push(DOT.reservations);
  if (day.privateEventCount > 0) dots.push(DOT.events);
  if (day.plannedStaffCount > 0) dots.push(DOT.staff);
  if (day.scheduledNewsCount > 0) dots.push(DOT.news);
  if (day.holidayName) dots.push(DOT.holiday);
  if (day.hoursException) {
    dots.push(day.hoursException.closed ? "#dc2626" : DOT.hours);
  }
  if (dots.length === 0) return <span className="h-1.5" aria-hidden />;
  return (
    <span className="flex h-1.5 items-center justify-center gap-0.5">
      {dots.slice(0, 4).map((color, i) => (
        <span
          key={`${color}-${i}`}
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function DashboardCalendarTile() {
  const { restaurantId, ready: restaurantReady } = useWorkspaceRestaurantUuid();
  const timeZone = useRestaurantIanaTimezone(restaurantId);
  const [month, setMonth] = useState(() => restaurantMonthKey(timeZone));
  const { data, loading, error, reload } = useDashboardCalendarSummary(
    restaurantId,
    month,
  );
  const showSkeleton = useDeferredSkeleton(loading && !data);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayYmd = restaurantTodayYmd(timeZone);
  const daysByDate = useMemo(() => {
    const map = new Map<string, DashboardCalendarDaySummary>();
    for (const day of data?.days ?? []) map.set(day.date, day);
    return map;
  }, [data]);

  const gridCells = useMemo(() => {
    if (!data?.days.length) return [];
    const first = data.days[0]!.date;
    const lead = weekdayIndexMondayFirst(first);
    const cells: Array<DashboardCalendarDaySummary | null> = Array.from(
      { length: lead },
      () => null,
    );
    cells.push(...data.days);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [data]);

  const selectedDay = selectedDate
    ? (daysByDate.get(selectedDate) ?? null)
    : null;

  const selectedDayLabel = useMemo(() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y!, m! - 1, d!)));
  }, [selectedDate]);

  const ready = restaurantReady && Boolean(restaurantId);

  return (
    <>
      <DashboardWidgetShell
        title="Kalender"
        description={formatMonthTitleDe(month)}
        icon={<CalendarRange className="size-4" aria-hidden />}
        staticChrome
        ready={ready}
        loading={showSkeleton}
        error={error}
        cardClassName="min-w-0"
        loadingContent={
          <div className="space-y-3">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Vorheriger Monat"
              onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-medium capitalize text-foreground">
              {formatMonthTitleDe(month)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Nächster Monat"
              onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DASHBOARD_CALENDAR_WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {label}
              </div>
            ))}
            {gridCells.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="min-h-11" />;
              }
              const isToday = day.date === todayYmd;
              const hasSignals = dashboardCalendarDayHasSignals(day);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={cn(
                    "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-0.5 py-1 text-xs transition-colors",
                    "hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    isToday
                      ? "border-accent/50 bg-accent/10 font-semibold text-foreground"
                      : hasSignals
                        ? "border-border/50 bg-card text-foreground"
                        : "border-transparent text-muted-foreground",
                    day.hoursException?.closed &&
                      "bg-red-500/8 dark:bg-red-500/12",
                    day.holidayName && !day.hoursException?.closed &&
                      "bg-amber-500/8 dark:bg-amber-500/12",
                  )}
                  aria-label={`${day.date}${hasSignals ? ", mit Einträgen" : ""}`}
                >
                  <span className="tabular-nums leading-none">
                    {Number(day.date.slice(-2))}
                  </span>
                  <DayDots day={day} />
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/40 pt-2">
            <LegendItem color={DOT.reservations} label="Reservierungen" />
            <LegendItem color={DOT.events} label="Veranstaltungen" />
            <LegendItem color={DOT.staff} label="Schichtplan" />
            <LegendItem color={DOT.news} label="Posts" />
            <LegendItem color={DOT.holiday} label="Feiertag" />
            <LegendItem color={DOT.hours} label="Sonderzeiten" />
          </div>
        </div>
      </DashboardWidgetShell>

      <DashboardCalendarDaySheet
        open={selectedDate != null}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
        restaurantId={restaurantId}
        day={selectedDay}
        dayLabel={selectedDayLabel}
        onHoursChanged={reload}
      />
    </>
  );
}
