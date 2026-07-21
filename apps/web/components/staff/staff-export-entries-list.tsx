"use client";

import {
  entryDurationHours,
  formatWorkTimeRangeWithHoursDe,
} from "@/lib/staff/staff-work-hours-summary";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { formatDayHeadingDe } from "@/lib/reservations/month-range";

const timeDe = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

function dayHeadingForEntry(e: RestaurantStaffWorkEntryRow): string {
  return formatDayHeadingDe(new Date(e.starts_at));
}

export function StaffExportEntryRow({
  entry,
  showDay = false,
}: {
  entry: RestaurantStaffWorkEntryRow;
  showDay?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <StaffWorkEntryTypeStripe
        type={entry.entry_type}
        className="mt-1 self-stretch"
      />
      <span className="min-w-0 flex-1">
        {showDay ? (
          <span className="block text-xs text-muted-foreground">
            {dayHeadingForEntry(entry)}
          </span>
        ) : null}
        <span className="font-medium">
          {STAFF_WORK_ENTRY_LABELS[entry.entry_type]}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
          {formatWorkTimeRangeWithHoursDe(
            `${timeDe.format(new Date(entry.starts_at))} – ${timeDe.format(new Date(entry.ends_at))}`,
            entryDurationHours(entry),
          )}
        </span>
      </span>
    </div>
  );
}

export function StaffExportEntriesByDay({
  days,
}: {
  days: {
    dayKey: string;
    heading: string;
    entries: RestaurantStaffWorkEntryRow[];
  }[];
}) {
  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>;
  }

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div
          key={day.dayKey}
          className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2"
        >
          <p className="mb-2 text-sm font-medium">{day.heading}</p>
          <ul className="space-y-1.5">
            {day.entries.map((e) => (
              <li key={e.id}>
                <StaffExportEntryRow entry={e} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
