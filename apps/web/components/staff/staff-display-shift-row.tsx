"use client";

import { useMemo } from "react";
import { StaffDisplayShiftSegmentsList } from "@/components/staff/staff-display-shift-segments-list";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  createRestaurantDateTimeFormatter,
} from "@/lib/restaurant/restaurant-timezone";
import { displayShiftBounds } from "@/lib/staff/staff-work-hours-display";
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
      <p className="font-medium">
        Display-Schicht
        {bounds.isOpen ? (
          <span className="ml-1.5 text-xs font-normal text-accent">(läuft)</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
        {timeDe.format(new Date(bounds.startsAt))} – {endLabel}
      </p>
      <StaffDisplayShiftSegmentsList
        segments={segments}
        timeZone={timeZone}
        className="mt-2"
      />
    </div>
  );
}
