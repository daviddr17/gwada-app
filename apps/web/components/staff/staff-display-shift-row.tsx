"use client";

import { useMemo } from "react";
import { StaffDisplayShiftSegmentsList } from "@/components/staff/staff-display-shift-segments-list";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  createRestaurantDateTimeFormatter,
} from "@/lib/restaurant/restaurant-timezone";
import { displayShiftBounds } from "@/lib/staff/staff-work-hours-display";
import { formatWorkTimeRangeWithHoursDe } from "@/lib/staff/staff-work-hours-summary";
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
  const endLabel = bounds.isOpen
    ? "läuft"
    : timeDe.format(new Date(bounds.endsAt!));

  return (
    <div className={cn("min-w-0 flex-1 text-sm", className)}>
      <div className="rounded-lg border border-border/40 bg-muted/15 px-2.5 py-2">
        <p className="font-medium">
          Display-Schicht
          {bounds.isOpen ? (
            <span className="ml-1.5 text-xs font-normal text-accent">(läuft)</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatWorkTimeRangeWithHoursDe(
            `${timeDe.format(new Date(bounds.startsAt))} – ${endLabel}`,
            bounds.isOpen || !bounds.endsAt
              ? null
              : Math.max(
                  0,
                  (new Date(bounds.endsAt).getTime() -
                    new Date(bounds.startsAt).getTime()) /
                    3_600_000,
                ),
          )}
        </p>
        <StaffDisplayShiftSegmentsList
          segments={segments}
          timeZone={timeZone}
          className="mt-2"
        />
      </div>
    </div>
  );
}
