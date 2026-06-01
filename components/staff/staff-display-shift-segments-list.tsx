"use client";

import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";
import { cn } from "@/lib/utils";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

function segmentEndLabel(segment: RestaurantStaffWorkEntryRow): string {
  if (segment.is_open) return "läuft";
  return timeDe.format(new Date(segment.ends_at));
}

/** Chronologische Display-Schicht-Segmente (Arbeit grün, Pause blau) mit Uhrzeiten. */
export function StaffDisplayShiftSegmentsList({
  segments,
  className,
}: {
  segments: RestaurantStaffWorkEntryRow[];
  className?: string;
}) {
  return (
    <ul className={cn("space-y-1.5", className)}>
      {segments.map((segment) => (
        <li key={segment.id} className="flex items-start gap-2">
          <StaffWorkEntryTypeStripe
            type={segment.entry_type}
            className="mt-0.5 self-stretch"
          />
          <span className="min-w-0 flex-1">
            <span className="font-medium">
              {STAFF_WORK_ENTRY_LABELS[segment.entry_type]}
            </span>
            <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
              {timeDe.format(new Date(segment.starts_at))} –{" "}
              {segmentEndLabel(segment)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
