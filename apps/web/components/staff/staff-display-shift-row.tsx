"use client";

import { useMemo } from "react";
import { StaffDisplayShiftSegmentsList } from "@/components/staff/staff-display-shift-segments-list";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  createRestaurantDateTimeFormatter,
} from "@/lib/restaurant/restaurant-timezone";
import {
  displayShiftBounds,
  displayShiftHoursBreakdown,
  displayShiftTitle,
} from "@/lib/staff/staff-work-hours-display";
import {
  formatHoursDe,
  formatWorkTimeRangeWithHoursDe,
} from "@/lib/staff/staff-work-hours-summary";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

export function StaffDisplayShiftRow({
  segments,
  timeZone = DEFAULT_RESTAURANT_TIMEZONE,
  className,
}: {
  segments: RestaurantStaffWorkEntryRow[];
  timeZone?: string;
  className?: string;
}) {
  const timeDe = useMemo(
    () =>
      createRestaurantDateTimeFormatter(timeZone, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [timeZone],
  );
  const bounds = displayShiftBounds(segments);
  const title = displayShiftTitle(segments);
  const endLabel = bounds.isOpen
    ? "läuft"
    : timeDe.format(new Date(bounds.endsAt!));
  const breakdown = displayShiftHoursBreakdown(segments);
  const presenceHours = breakdown.presenceMs / 3_600_000;
  const netWorkHours = breakdown.netMs / 3_600_000;
  const breakHours = breakdown.breakMs / 3_600_000;
  const hasBreak = breakHours > 0.0005;

  return (
    <div
      className={cn(
        "min-w-0 flex-1 rounded-lg border border-border/40 bg-muted/15 px-2.5 py-2 text-sm transition-colors group-hover:bg-muted/25",
        className,
      )}
    >
      <p className="font-medium">
        {title}
        {bounds.isOpen ? (
          <span className="ml-1.5 text-xs font-normal text-accent">(läuft)</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
        {formatWorkTimeRangeWithHoursDe(
          `${timeDe.format(new Date(bounds.startsAt))} – ${endLabel}`,
          // Spanne = Anwesenheit; Netto separat, sonst wirkt Pause „nicht abgezogen“.
          presenceHours,
        )}
      </p>
      {hasBreak ? (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          Pause {formatHoursDe(breakHours)} · Netto {formatHoursDe(netWorkHours)}
        </p>
      ) : null}
      <StaffDisplayShiftSegmentsList
        segments={segments}
        timeZone={timeZone}
        className="mt-2"
      />
    </div>
  );
}
