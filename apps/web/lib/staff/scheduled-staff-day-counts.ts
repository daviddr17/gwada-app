import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";

export type ScheduledShiftCountRow = {
  staff_id: string;
  starts_at: string;
  status: string;
};

/** Eindeutige geplante Mitarbeiter (ohne abgelehnte Schichten). */
export function countUniquePlannedStaffIds(
  rows: readonly Pick<ScheduledShiftCountRow, "staff_id" | "status">[],
): number {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.status === "declined") continue;
    if (!row.staff_id) continue;
    ids.add(row.staff_id);
  }
  return ids.size;
}

/**
 * Eindeutige geplante Mitarbeiter pro Restaurant-Kalendertag
 * (Zuordnung über starts_at — gleiche Semantik wie Schichtplan-Tageszelle / Sheet).
 */
export function countScheduledStaffByRestaurantDay(
  rows: readonly ScheduledShiftCountRow[],
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): Map<string, number> {
  const staffByDay = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.status === "declined") continue;
    if (!row.staff_id) continue;
    const dayKey = restaurantZonedDateKey(
      new Date(row.starts_at),
      timeZone,
    );
    const bucket = staffByDay.get(dayKey) ?? new Set<string>();
    bucket.add(row.staff_id);
    staffByDay.set(dayKey, bucket);
  }

  const counts = new Map<string, number>();
  for (const [dayKey, staffIds] of staffByDay) {
    counts.set(dayKey, staffIds.size);
  }
  return counts;
}
