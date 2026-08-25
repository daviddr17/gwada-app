"use client";

import { useMemo } from "react";
import { Droplets } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useDashboardWeatherForecast } from "@/lib/hooks/use-dashboard-weather-forecast";
import {
  parseRestaurantYmdKey,
  restaurantTodayYmd,
  utcInstantForRestaurantLocal,
} from "@/lib/restaurant/restaurant-timezone";
import { cn } from "@/lib/utils";
import { resolveWeatherAmbienceKind } from "@/lib/weather/weather-ambience-kind";
import type { VisualCrossingDay } from "@/lib/weather/visual-crossing-types";
import {
  ShiftPlanWeatherIcon,
  parseShiftPlanWeatherByDate,
} from "@/lib/weather/shift-plan-day-weather";

const nf0 = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

function roundTemp(value: number | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value);
}

function formatWeekdayShort(
  ymd: string,
  timeZone: string,
  todayYmd: string,
): string {
  if (ymd === todayYmd) return "Heute";
  const parsed = parseRestaurantYmdKey(ymd);
  if (!parsed) return ymd;
  const instant = utcInstantForRestaurantLocal(
    parsed.year,
    parsed.month,
    parsed.day,
    12,
    0,
    timeZone,
  );
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    weekday: "short",
  }).format(instant);
}

function ForecastDayRow({
  day,
  ymd,
  timeZone,
  todayYmd,
  weekMin,
  weekMax,
}: {
  day: VisualCrossingDay;
  ymd: string;
  timeZone: string;
  todayYmd: string;
  weekMin: number;
  weekMax: number;
}) {
  const parsed = parseShiftPlanWeatherByDate({ days: [day] }).get(ymd);
  const tempMin =
    roundTemp(day.tempmin) ??
    parsed?.tempMinC ??
    roundTemp(day.temp) ??
  null;
  const tempMax =
    roundTemp(day.tempmax) ??
    parsed?.tempMaxC ??
    roundTemp(day.temp) ??
  null;
  const precip =
    day.precipprob != null && !Number.isNaN(day.precipprob)
      ? Math.round(day.precipprob)
      : (parsed?.precipProb ?? null);

  const kind = resolveWeatherAmbienceKind({
    icon: day.icon,
    conditions: day.conditions ?? day.description,
  });

  const span = weekMax - weekMin;
  const barLeft =
    tempMin != null && span > 0
      ? Math.max(0, Math.min(100, ((tempMin - weekMin) / span) * 100))
      : 0;
  const barWidth =
    tempMin != null && tempMax != null && span > 0
      ? Math.max(
          8,
          Math.min(100 - barLeft, ((tempMax - tempMin) / span) * 100),
        )
      : 0;

  return (
    <li
      className="grid grid-cols-[3.25rem_1.75rem_2rem_minmax(0,1fr)_2rem_2.75rem] items-center gap-x-2 gap-y-0 py-2.5"
    >
      <span className="text-sm font-medium text-foreground">
        {formatWeekdayShort(ymd, timeZone, todayYmd)}
      </span>
      <ShiftPlanWeatherIcon kind={kind} className="size-5" />
      <span
        className="text-right text-sm tabular-nums text-muted-foreground"
        aria-label={`Tief ${tempMin ?? "—"} °C`}
      >
        {tempMin != null ? nf0.format(tempMin) : "—"}
      </span>
      <div
        className="relative h-1.5 rounded-full bg-muted/80"
        aria-hidden
      >
        {tempMin != null && tempMax != null ? (
          <div
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-400/70 via-amber-300/80 to-orange-400/80"
            style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
          />
        ) : null}
      </div>
      <span
        className="text-right text-sm font-semibold tabular-nums text-foreground"
        aria-label={`Hoch ${tempMax ?? "—"} °C`}
      >
        {tempMax != null ? nf0.format(tempMax) : "—"}
      </span>
      <span
        className={cn(
          "inline-flex items-center justify-end gap-0.5 text-xs tabular-nums",
          precip != null && precip > 0
            ? "text-sky-600 dark:text-sky-400"
            : "text-muted-foreground",
        )}
        aria-label={
          precip != null ? `Regenwahrscheinlichkeit ${precip} %` : undefined
        }
      >
        {precip != null && precip > 0 ? (
          <>
            <Droplets className="size-3 shrink-0 opacity-80" aria-hidden />
            {nf0.format(precip)}%
          </>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </span>
    </li>
  );
}

export function DashboardWeatherForecastSheet({
  open,
  onOpenChange,
  location,
  locationLabel,
  timeZone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: string;
  locationLabel: string;
  timeZone: string;
}) {
  const todayYmd = restaurantTodayYmd(timeZone);
  const { days, loading, error, fromYmd, toYmd } = useDashboardWeatherForecast({
    location,
    timeZone,
    enabled: open,
  });

  const showSkeleton = useDeferredSkeleton(open && loading && days.length === 0);

  const weekBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const day of days) {
      const tMin = roundTemp(day.tempmin) ?? roundTemp(day.temp);
      const tMax = roundTemp(day.tempmax) ?? roundTemp(day.temp);
      if (tMin != null) min = Math.min(min, tMin);
      if (tMax != null) max = Math.max(max, tMax);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { weekMin: 0, weekMax: 30 };
    }
    if (min === max) {
      return { weekMin: min - 2, weekMax: max + 2 };
    }
    return { weekMin: min, weekMax: max };
  }, [days]);

  const dateRangeLabel = useMemo(() => {
    if (!fromYmd || !toYmd) return locationLabel;
    const fromParsed = parseRestaurantYmdKey(fromYmd);
    const toParsed = parseRestaurantYmdKey(toYmd);
    if (!fromParsed || !toParsed) return locationLabel;
    const fromInstant = utcInstantForRestaurantLocal(
      fromParsed.year,
      fromParsed.month,
      fromParsed.day,
      12,
      0,
      timeZone,
    );
    const toInstant = utcInstantForRestaurantLocal(
      toParsed.year,
      toParsed.month,
      toParsed.day,
      12,
      0,
      timeZone,
    );
    const fmt = new Intl.DateTimeFormat("de-DE", {
      timeZone,
      day: "numeric",
      month: "short",
    });
    return `${locationLabel} · ${fmt.format(fromInstant)} – ${fmt.format(toInstant)}`;
  }, [fromYmd, locationLabel, timeZone, toYmd]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Wetterprognose
          </DrawerTitle>
          <DrawerDescription>{dateRangeLabel}</DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : showSkeleton ? (
            <div className="space-y-3 py-2" aria-busy="true">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : days.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine Prognosedaten verfügbar.
            </p>
          ) : (
            <ul className="divide-y divide-border/40" aria-label="7-Tage-Prognose">
              {days.map((day) => {
                const ymd = day.datetime?.slice(0, 10);
                if (!ymd) return null;
                return (
                  <ForecastDayRow
                    key={ymd}
                    day={day}
                    ymd={ymd}
                    timeZone={timeZone}
                    todayYmd={todayYmd}
                    weekMin={weekBounds.weekMin}
                    weekMax={weekBounds.weekMax}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
