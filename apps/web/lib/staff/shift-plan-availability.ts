import { localDayKey } from "@/lib/staff/shift-schedule-range";
import type { Weekday } from "@/lib/types/restaurant";
import type { RestaurantStaffAvailabilitySlotRow } from "@/lib/types/staff-availability";
import { STAFF_AVAILABILITY_WEEKDAY_LABELS } from "@/lib/types/staff-availability";

const JS_DAY_TO_WEEKDAY: Record<number, Weekday> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

export const SHIFT_PLAN_AVAILABILITY_COLOR = "#22c55e";

export function weekdayFromLocalDate(d: Date): Weekday {
  return JS_DAY_TO_WEEKDAY[d.getDay()]!;
}

export function formatAvailabilityTimeHm(time: string): string {
  return time.slice(0, 5);
}

export function formatAvailabilitySlotRangeDe(
  slot: Pick<RestaurantStaffAvailabilitySlotRow, "start_time" | "end_time">,
): string {
  return `${formatAvailabilityTimeHm(slot.start_time)}–${formatAvailabilityTimeHm(slot.end_time)}`;
}

export function formatAvailabilitySlotLabelDe(
  slot: RestaurantStaffAvailabilitySlotRow,
): string {
  const range = formatAvailabilitySlotRangeDe(slot);
  if (slot.weekday) {
    return `${STAFF_AVAILABILITY_WEEKDAY_LABELS[slot.weekday]} ${range}`;
  }
  if (slot.service_date) {
    const [y, m, d] = slot.service_date.split("-").map(Number);
    const dateLabel = new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(y!, (m ?? 1) - 1, d ?? 1));
    return `${dateLabel}. ${range}`;
  }
  return range;
}

export function resolveAvailabilitySlotsForDay(
  slots: readonly RestaurantStaffAvailabilitySlotRow[],
  staffId: string,
  day: Date,
): RestaurantStaffAvailabilitySlotRow[] {
  const dayKey = localDayKey(day);
  const weekday = weekdayFromLocalDate(day);
  return slots
    .filter((slot) => {
      if (slot.staff_id !== staffId) return false;
      if (slot.service_date) return slot.service_date === dayKey;
      return slot.weekday === weekday;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function buildAvailabilityMaps(
  slots: readonly RestaurantStaffAvailabilitySlotRow[],
  days: readonly Date[],
): Map<string, RestaurantStaffAvailabilitySlotRow[]> {
  const map = new Map<string, RestaurantStaffAvailabilitySlotRow[]>();
  for (const day of days) {
    const dayKey = localDayKey(day);
    const staffIds = new Set(slots.map((s) => s.staff_id));
    for (const staffId of staffIds) {
      const resolved = resolveAvailabilitySlotsForDay(slots, staffId, day);
      if (resolved.length === 0) continue;
      map.set(`${staffId}__${dayKey}`, resolved);
    }
  }
  return map;
}

export function staffHasAvailabilityOnDay(
  slots: readonly RestaurantStaffAvailabilitySlotRow[],
  staffId: string,
  day: Date,
): boolean {
  return resolveAvailabilitySlotsForDay(slots, staffId, day).length > 0;
}
