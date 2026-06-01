"use client";

import { StaffDisplayShiftSegmentsList } from "@/components/staff/staff-display-shift-segments-list";
import { displayShiftBounds } from "@/lib/staff/staff-work-hours-display";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

export function StaffDisplayShiftRow({
  segments,
}: {
  segments: RestaurantStaffWorkEntryRow[];
}) {
  const bounds = displayShiftBounds(segments);
  const endLabel = bounds.isOpen
    ? "läuft"
    : timeDe.format(new Date(bounds.endsAt!));

  return (
    <div className="rounded-lg border border-border/40 px-3 py-2 text-sm">
      <p className="font-medium">
        Display-Schicht
        {bounds.isOpen ? (
          <span className="ml-1.5 text-xs font-normal text-accent">(läuft)</span>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
        {timeDe.format(new Date(bounds.startsAt))} – {endLabel}
      </p>
      <StaffDisplayShiftSegmentsList segments={segments} className="mt-2" />
    </div>
  );
}
