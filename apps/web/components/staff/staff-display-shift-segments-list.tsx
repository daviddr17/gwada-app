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
  onOpenSegment,
}: {
  segments: RestaurantStaffWorkEntryRow[];
  timeZone?: string;
  className?: string;
  /** Einzelsegment öffnen (z. B. Pause bearbeiten), statt die ganze Schicht. */
  onOpenSegment?: (segment: RestaurantStaffWorkEntryRow) => void;
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
        const body = (
          <>
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
          </>
        );
        return (
          <li
            key={segment.id}
            className={cn("flex items-start gap-2", isBreak && "ml-4")}
          >
            {onOpenSegment ? (
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-md text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenSegment(segment);
                }}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
