"use client";

import { PublicOpeningHoursDisplay } from "@/components/opening-hours/public-opening-hours-display";
import type { PublicEmbedOpeningHoursSettings } from "@/lib/opening-hours/public-opening-hours-server";
import type { DateHoursException, DayHours, Weekday } from "@/lib/types/restaurant";

export function RestaurantPublicOpeningHours({
  weeklyHours,
  kitchenHoursEnabled,
  kitchenWeeklyHours,
  dateExceptions,
  openingHoursSettings,
  className,
}: {
  weeklyHours: Record<Weekday, DayHours>;
  kitchenHoursEnabled: boolean;
  kitchenWeeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
  openingHoursSettings: PublicEmbedOpeningHoursSettings;
  className?: string;
}) {
  return (
    <PublicOpeningHoursDisplay
      weeklyHours={weeklyHours}
      kitchenHoursEnabled={kitchenHoursEnabled}
      kitchenWeeklyHours={kitchenWeeklyHours}
      dateExceptions={dateExceptions}
      settings={openingHoursSettings}
      className={className}
    />
  );
}
