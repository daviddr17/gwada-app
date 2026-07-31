import {
  addRestaurantCalendarDaysYmd,
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";

export type ScheduledShiftCountRow = {
  staff_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

/**
 * Restaurant-Kalendertage, die eine Schicht berührt (halb-offen [starts, ends)).
 * Eine Schicht 22:00–02:00 zählt für Starttag und Folgetag.
 */
export function restaurantDaysOverlappedByShift(
  startsAtIso: string,
  endsAtIso: string,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): string[] {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(endsAtIso);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return [];
  }
  if (!(endsAt.getTime() > startsAt.getTime())) return [];

  const lastInstant = new Date(endsAt.getTime() - 1);
  let ymd = restaurantZonedDateKey(startsAt, timeZone);
  const endYmd = restaurantZonedDateKey(lastInstant, timeZone);
  const days: string[] = [];
  for (let i = 0; i < 62; i++) {
    days.push(ymd);
    if (ymd === endYmd) break;
    ymd = addRestaurantCalendarDaysYmd(ymd, 1, timeZone);
  }
  return days;
}

/**
 * Eindeutige geplante Mitarbeiter pro Restaurant-Kalendertag
 * (ohne abgelehnte Schichten; Übernacht-Schichten zählen an jedem berührten Tag).
 */
export function countScheduledStaffByRestaurantDay(
  rows: readonly ScheduledShiftCountRow[],
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): Map<string, number> {
  const staffByDay = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.status === "declined") continue;
    const staffId = row.staff_id;
    if (!staffId) continue;
    for (const dayKey of restaurantDaysOverlappedByShift(
      row.starts_at,
      row.ends_at,
      timeZone,
    )) {
      const bucket = staffByDay.get(dayKey) ?? new Set<string>();
      bucket.add(staffId);
      staffByDay.set(dayKey, bucket);
    }
  }

  const counts = new Map<string, number>();
  for (const [dayKey, staffIds] of staffByDay) {
    counts.set(dayKey, staffIds.size);
  }
  return counts;
}

export function countScheduledStaffForRestaurantDay(
  rows: readonly ScheduledShiftCountRow[],
  dayKey: string,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): number {
  return countScheduledStaffByRestaurantDay(rows, timeZone).get(dayKey) ?? 0;
}
