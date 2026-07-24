"use client";

import { useMemo } from "react";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  createRestaurantDateTimeFormatter,
} from "@/lib/restaurant/restaurant-timezone";
import {
  entryDurationHours,
  formatWorkTimeRangeWithHoursDe,
} from "@/lib/staff/staff-work-hours-summary";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

/** Chronologische Display-Schicht-Segmente — Pausen eingerückt unter der Schicht. */
export function StaffDisplayShiftSegmentsList({
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

  return (
    <ul className={cn("space-y-1.5", className)}>
      {segments.map((segment) => {
        const isBreak = segment.entry_type === "break";
        return (
          <li
            key={segment.id}
            className={cn(
              "flex items-start gap-2",
              isBreak &&
                "ml-4 border-l-2 border-sky-500/35 pl-3 dark:border-sky-400/40",
            )}
          >
            <StaffWorkEntryTypeStripe
              type={segment.entry_type}
              className="mt-0.5 self-stretch"
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium">
                {STAFF_WORK_ENTRY_LABELS[segment.entry_type]}
              </span>
              <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                {formatWorkTimeRangeWithHoursDe(
                  `${timeDe.format(new Date(segment.starts_at))} – ${
                    segment.is_open
                      ? "läuft"
                      : timeDe.format(new Date(segment.ends_at))
                  }`,
                  segment.is_open ? null : entryDurationHours(segment),
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
