"use client";

import { WEEKDAY_LABEL_DE, WEEKDAY_ORDER } from "@/lib/constants/restaurant-profile";
import type { DayHours, Weekday } from "@/lib/types/restaurant";
import { cn } from "@/lib/utils";

function formatDayHours(hours: DayHours): string {
  if (hours.closed) return "Geschlossen";
  if (hours.open && hours.close) return `${hours.open} – ${hours.close}`;
  return "—";
}

export function RestaurantPublicOpeningHours({
  weeklyHours,
  className,
}: {
  weeklyHours: Record<Weekday, DayHours>;
  className?: string;
}) {
  return (
    <dl className={cn("space-y-2", className)}>
      {WEEKDAY_ORDER.map((day) => (
        <div
          key={day}
          className="flex items-baseline justify-between gap-4 text-sm"
        >
          <dt className="font-medium text-foreground">{WEEKDAY_LABEL_DE[day]}</dt>
          <dd className="tabular-nums text-muted-foreground">
            {formatDayHours(weeklyHours[day])}
          </dd>
        </div>
      ))}
    </dl>
  );
}
