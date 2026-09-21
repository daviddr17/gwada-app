"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DashboardCalendarDaySheet } from "@/components/dashboard/dashboard-calendar-day-sheet";
import {
  DashboardCalendarDayStatusIcons,
  DashboardCalendarStatusLegend,
} from "@/components/dashboard/dashboard-calendar-day-status-icons";
import {
  AppFullscreenOverlay,
  appFullscreenOverlayScrollClassName,
} from "@/components/ui/app-fullscreen-overlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  DASHBOARD_CALENDAR_WEEKDAY_LABELS,
  emptyCalendarMonthDays,
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
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { APP_SIGNAL_COLORS } from "@/lib/ui/app-signal-colors";
import { cn } from "@/lib/utils";

const DOT = {
  reservations: APP_SIGNAL_COLORS.reservations,
  events: APP_SIGNAL_COLORS.events,
  staff: APP_SIGNAL_COLORS.staff,
  news: APP_SIGNAL_COLORS.news,
} as const;

function DayActivityDots({ day }: { day: DashboardCalendarDaySummary }) {
  const dots: string[] = [];
  if (day.reservationCount > 0) dots.push(DOT.reservations);
  if (day.privateEventCount > 0) dots.push(DOT.events);
  if (day.plannedStaffCount > 0) dots.push(DOT.staff);
  if (day.scheduledNewsCount > 0) dots.push(DOT.news);
  if (dots.length === 0) {
    return <DashboardCalendarDayStatusIcons day={day} />;
  }
  return (
    <span className="flex flex-col items-center justify-center gap-0.5 md:gap-1">
      <span className="flex h-1.5 items-center justify-center gap-0.5 md:h-2 md:gap-1">
        {dots.slice(0, 4).map((color, i) => (
          <span
            key={`${color}-${i}`}
            className="size-1.5 rounded-full md:size-2"
            style={{ backgroundColor: color }}
          />
        ))}
      </span>
      <DashboardCalendarDayStatusIcons day={day} />
    </span>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground md:text-xs">
      <span
        className="size-1.5 rounded-full md:size-2"
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
  /** Hintergrund-Prefetch solange Dashboard aktiv (kein Warten beim Öffnen). */
  warm?: boolean;
};

export function DashboardCalendarOverlay({
  open,
  onClose,
  warm = false,
}: DashboardCalendarOverlayProps) {
  const { restaurantId, ready: restaurantReady } = useWorkspaceRestaurantUuid();
  const timeZone = useRestaurantIanaTimezone(restaurantId);
  const [month, setMonth] = useState(() => restaurantMonthKey(timeZone));
  const fetchRestaurantId =
    (open || warm) && restaurantReady && restaurantId ? restaurantId : null;
  const { data, loading, error, reload } = useDashboardCalendarSummary(
    fetchRestaurantId,
    month,
  );
  const monthMatches = data?.month === month;
  const showSkeleton = useDeferredSkeleton(
    Boolean(open) &&
      restaurantReady &&
      Boolean(restaurantId) &&
      loading &&
      !monthMatches &&
      !error,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSelectedDate(null);
  }, [open]);

  // TZ-Korrektur nur wenn Nutzer noch auf „aktueller Monat“ der alten TZ ist.
  const timeZoneRef = useRef(timeZone);
  useEffect(() => {
    if (!restaurantReady) return;
    const prevTz = timeZoneRef.current;
    timeZoneRef.current = timeZone;
    if (prevTz === timeZone) return;
    setMonth((m) =>
      m === restaurantMonthKey(prevTz) ? restaurantMonthKey(timeZone) : m,
    );
  }, [restaurantReady, timeZone]);

  const todayYmd = restaurantTodayYmd(timeZone);
  const displayDays = useMemo(() => {
    if (monthMatches && data?.days.length) return data.days;
    return emptyCalendarMonthDays(month);
  }, [data, month, monthMatches]);

  const daysByDate = useMemo(() => {
    const map = new Map<string, DashboardCalendarDaySummary>();
    for (const day of displayDays) map.set(day.date, day);
    return map;
  }, [displayDays]);

  const gridCells = useMemo(() => {
    if (!displayDays.length) return [];
    const first = displayDays[0]!.date;
    const lead = weekdayIndexMondayFirst(first);
    const cells: Array<DashboardCalendarDaySummary | null> = Array.from(
      { length: lead },
      () => null,
    );
    cells.push(...displayDays);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [displayDays]);

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
            "px-3 py-4 sm:px-5 md:px-8 md:py-6",
          )}
        >
          <div className="mx-auto flex w-full max-w-lg flex-col gap-4 md:max-w-4xl md:gap-5 lg:max-w-5xl xl:max-w-6xl">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="md:size-10"
                aria-label="Vorheriger Monat"
                onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
              >
                <ChevronLeft className="size-4 md:size-5" />
              </Button>
              <p className="text-sm font-medium capitalize text-foreground md:text-lg">
                {formatMonthTitleDe(month)}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="md:size-10"
                aria-label="Nächster Monat"
                onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
              >
                <ChevronRight className="size-4 md:size-5" />
              </Button>
            </div>

            {restaurantReady && !restaurantId ? (
              <WorkspaceRestaurantMissingMessage className="py-8" />
            ) : !restaurantReady ? (
              <WorkspaceRestaurantResolvePlaceholder className="py-8" />
            ) : error && !monthMatches ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-center text-sm text-destructive">{error}</p>
                <Button
                  type="button"
                  size="sm"
                  className={brandActionButtonRoundedClassName}
                  onClick={reload}
                >
                  Erneut versuchen
                </Button>
              </div>
            ) : showSkeleton && !displayDays.length ? (
              <div className="space-y-3" aria-busy>
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl md:h-[28rem]" />
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    "space-y-1.5 md:space-y-2",
                    loading && !monthMatches && "opacity-70",
                  )}
                  aria-busy={loading && !monthMatches}
                >
                  <div className="grid grid-cols-7 gap-1.5 md:gap-2.5 lg:gap-3">
                    {DASHBOARD_CALENDAR_WEEKDAY_LABELS.map((label) => (
                      <div
                        key={label}
                        className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:py-1.5 md:text-xs"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  <div
                    className={cn(
                      "grid grid-cols-7 gap-1.5 md:gap-2.5 lg:gap-3",
                      "md:min-h-[min(36rem,calc(100dvh-16rem))] md:auto-rows-fr",
                    )}
                  >
                    {gridCells.map((day, index) => {
                      if (!day) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="min-h-12 md:min-h-0"
                          />
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
                            "md:min-h-0 md:gap-1.5 md:rounded-2xl md:px-1 md:py-2 md:text-base",
                            "hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            isToday
                              ? "border-accent/50 bg-accent/10 font-semibold text-foreground"
                              : hasSignals
                                ? "border-border/50 bg-card text-foreground"
                                : "border-transparent text-muted-foreground",
                          )}
                          aria-label={`${day.date}${hasSignals ? ", mit Einträgen" : ""}${day.hoursException?.closed ? ", geschlossen" : ""}${day.holidayName ? `, Feiertag ${day.holidayName}` : ""}`}
                        >
                          <span className="tabular-nums leading-none md:text-lg lg:text-xl">
                            {Number(day.date.slice(-2))}
                          </span>
                          <DayActivityDots day={day} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1.5 border-t border-border/40 pt-3 md:gap-x-5 md:pt-4">
                  <LegendItem color={DOT.reservations} label="Reservierungen" />
                  <LegendItem color={DOT.events} label="Veranstaltungen" />
                  <LegendItem color={DOT.staff} label="Schichtplan" />
                  <LegendItem color={DOT.news} label="Posts" />
                  <DashboardCalendarStatusLegend />
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
