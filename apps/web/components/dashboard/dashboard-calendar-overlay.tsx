"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DashboardCalendarDaySheet } from "@/components/dashboard/dashboard-calendar-day-sheet";
import {
  AppFullscreenOverlay,
  appFullscreenOverlayScrollClassName,
} from "@/components/ui/app-fullscreen-overlay";
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
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import { APP_SIGNAL_COLORS } from "@/lib/ui/app-signal-colors";
import { cn } from "@/lib/utils";

const DOT = {
  reservations: APP_SIGNAL_COLORS.reservations,
  events: APP_SIGNAL_COLORS.events,
  staff: APP_SIGNAL_COLORS.staff,
  news: APP_SIGNAL_COLORS.news,
  holiday: APP_SIGNAL_COLORS.holiday,
  hours: APP_SIGNAL_COLORS.hoursOpen,
  hoursClosed: APP_SIGNAL_COLORS.hoursClosed,
} as const;

function DayDots({ day }: { day: DashboardCalendarDaySummary }) {
  const dots: string[] = [];
  if (day.reservationCount > 0) dots.push(DOT.reservations);
  if (day.privateEventCount > 0) dots.push(DOT.events);
  if (day.plannedStaffCount > 0) dots.push(DOT.staff);
  if (day.scheduledNewsCount > 0) dots.push(DOT.news);
  if (day.holidayName) dots.push(DOT.holiday);
  if (day.hoursException) {
    dots.push(day.hoursException.closed ? DOT.hoursClosed : DOT.hours);
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

type DashboardCalendarOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function DashboardCalendarOverlay({
  open,
  onClose,
}: DashboardCalendarOverlayProps) {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const timeZone = useRestaurantIanaTimezone(restaurantId);
  const [month, setMonth] = useState(() => restaurantMonthKey(timeZone));
  const { data, loading, error, reload } = useDashboardCalendarSummary(
    open ? restaurantId : null,
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

  return (
    <>
      <AppFullscreenOverlay
        open={open}
        onClose={onClose}
        aria-label="Kalender"
        header={
          <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="shrink-0 rounded-full border-border/60"
              aria-label="Schließen"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-base font-semibold tracking-tight">
                Kalender
              </p>
            </div>
            <span className="size-8 shrink-0" aria-hidden />
          </div>
        }
      >
        <div
          className={cn(
            appFullscreenOverlayScrollClassName,
            "px-3 py-4 sm:px-5",
          )}
        >
          <div className="mx-auto w-full max-w-lg space-y-4">
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

            {error ? (
              <p className="py-8 text-center text-sm text-destructive">
                {error}
              </p>
            ) : showSkeleton ? (
              <div className="space-y-3" aria-busy>
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1.5">
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
                      return (
                        <div key={`empty-${index}`} className="min-h-12" />
                      );
                    }
                    const isToday = day.date === todayYmd;
                    const hasSignals = dashboardCalendarDayHasSignals(day);
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDate(day.date)}
                        className={cn(
                          "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 text-sm transition-colors",
                          "hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          isToday
                            ? "border-accent/50 bg-accent/10 font-semibold text-foreground"
                            : hasSignals
                              ? "border-border/50 bg-card text-foreground"
                              : "border-transparent text-muted-foreground",
                          day.hoursException?.closed &&
                            "bg-red-500/8 dark:bg-red-500/12",
                          day.holidayName &&
                            !day.hoursException?.closed &&
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

                <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/40 pt-3">
                  <LegendItem color={DOT.reservations} label="Reservierungen" />
                  <LegendItem color={DOT.events} label="Veranstaltungen" />
                  <LegendItem color={DOT.staff} label="Schichtplan" />
                  <LegendItem color={DOT.news} label="Posts" />
                  <LegendItem color={DOT.holiday} label="Feiertag" />
                  <LegendItem color={DOT.hours} label="Sonderzeiten" />
                </div>
              </>
            )}
          </div>
        </div>
      </AppFullscreenOverlay>

      <DashboardCalendarDaySheet
        open={selectedDate != null}
        onOpenChange={(next) => {
          if (!next) setSelectedDate(null);
        }}
        restaurantId={restaurantId}
        day={selectedDay}
        dayLabel={selectedDayLabel}
        onHoursChanged={reload}
      />
    </>
  );
}
