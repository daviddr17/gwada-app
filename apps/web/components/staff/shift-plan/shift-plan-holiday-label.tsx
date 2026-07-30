"use client";

import { cn } from "@/lib/utils";
import { formatShiftPlanDayHeaderDateDe } from "@/lib/staff/shift-schedule-range";
import { ShiftPlanDayGroupPlannedCount } from "@/components/staff/shift-plan/shift-plan-day-position-counts";
import {
  ShiftPlanDayWeatherRow,
  type ShiftPlanDayWeather,
} from "@/lib/weather/shift-plan-day-weather";

/** Dezente Feiertags-Markierung im Schichtplan (neutral, kein Amber/Rot). */
export const shiftPlanHolidayLabelClassName = cn(
  "border border-border/50 bg-muted/40 font-normal text-muted-foreground",
);

/** Sonntags-Feiertage wie „Ostersonntag“ nicht extra labeln — „So“ reicht. */
export function shouldShowShiftPlanHolidayLabel(name: string): boolean {
  return !/\bsonntag\b/i.test(name.trim());
}

/** Reserviert in Wochen-/Tages-Headern Platz für Feiertag + Wetter (kein Höhensprung). */
export const shiftPlanDayHeaderMinHeightClassName = "min-h-[4.75rem]";

/** Feste Höhe für die Feiertags-Zeile unter Wochentag + Datum. */
export const shiftPlanDayHeaderHolidaySlotClassName =
  "mt-0.5 flex h-5 w-full shrink-0 items-center justify-center";

export function ShiftPlanWeekDayHeader({
  day,
  weekdayLabel,
  holidayName,
  weather,
  isToday = false,
  plannedStaffCount = 0,
  positionName,
  positionColor,
}: {
  day: Date;
  weekdayLabel: string;
  holidayName?: string;
  weather?: ShiftPlanDayWeather;
  isToday?: boolean;
  /** Geplante MA dieser Positionsgruppe am Tag. */
  plannedStaffCount?: number;
  positionName?: string;
  positionColor?: string;
}) {
  const showHoliday =
    holidayName && shouldShowShiftPlanHolidayLabel(holidayName);
  const showPlanned =
    plannedStaffCount > 0 &&
    positionName != null &&
    positionColor != null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-start",
        shiftPlanDayHeaderMinHeightClassName,
      )}
    >
      <div className={cn(isToday && "font-semibold text-foreground")}>
        {weekdayLabel}
      </div>
      <div
        className={cn(
          "flex items-center justify-center gap-1 whitespace-nowrap leading-tight",
          isToday && "font-semibold text-foreground",
        )}
      >
        <span className="tabular-nums text-[11px]">
          {formatShiftPlanDayHeaderDateDe(day)}
        </span>
        {showPlanned ? (
          <ShiftPlanDayGroupPlannedCount
            count={plannedStaffCount}
            positionName={positionName}
            positionColor={positionColor}
          />
        ) : null}
      </div>
      <div className={shiftPlanDayHeaderHolidaySlotClassName}>
        {showHoliday ? (
          <ShiftPlanHolidayLabel name={holidayName} className="mt-0" />
        ) : null}
      </div>
      <ShiftPlanDayWeatherRow weather={weather} />
    </div>
  );
}

/** Dezenter Feiertags-Hinweis im Schichtplan (unter Wochentag / im Tageskopf). */
export function ShiftPlanHolidayLabel({
  name,
  className,
  inline = false,
}: {
  name: string;
  className?: string;
  /** Neben dem Datum statt darunter (Monatskarten). */
  inline?: boolean;
}) {
  if (!shouldShowShiftPlanHolidayLabel(name)) return null;

  return (
    <span
      title={name}
      className={cn(
        "truncate",
        shiftPlanHolidayLabelClassName,
        inline
          ? "max-w-[min(12rem,40vw)] rounded-md px-1.5 py-px text-[11px]"
          : "mx-auto mt-0.5 block max-w-[5.5rem] rounded px-1 py-px text-[10px] leading-tight",
        className,
      )}
    >
      {name}
    </span>
  );
}
