import { reservationGuestDisplayName } from "@/lib/reservations/reservation-guest-name";
import {
  PRIVATE_EVENT_STRIPE_HEX,
  isPrivateEventReservation,
} from "@/lib/reservations/reservation-kind";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantDayBoundsIso,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";
import { scheduledShiftRangesOverlap } from "@/lib/staff/shift-plan-overlap";
import { fetchReservationsForRestaurant } from "@/lib/supabase/reservations-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { fetchScheduledShiftsInRange } from "@/lib/supabase/staff-shift-schedule-db";
import { formatShiftTimeRangeDe } from "@/lib/types/staff-shift-schedule";

export type ReservationDayEventStaffEntry = {
  staffId: string;
  name: string;
  /** True wenn Zeit mit einer Schichtplan-Schicht überlappt. */
  overlapsShift: boolean;
};

export type ReservationDayEventStaffGroup = {
  reservationId: string;
  eventTitle: string;
  timeLabel: string;
  startsAt: string;
  endsAt: string;
  color: string;
  entries: ReservationDayEventStaffEntry[];
};

/** Eindeutige Veranstaltungs-Mitarbeiter pro Restaurant-Kalendertag. */
export function countEventStaffByRestaurantDay(
  rows: readonly Pick<
    ReservationListRow,
    "kind" | "starts_at" | "assigned_staff"
  >[],
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): Map<string, number> {
  const staffByDay = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!isPrivateEventReservation(row)) continue;
    const assignees = row.assigned_staff ?? [];
    if (assignees.length === 0) continue;
    const dayKey = restaurantZonedDateKey(new Date(row.starts_at), timeZone);
    const bucket = staffByDay.get(dayKey) ?? new Set<string>();
    for (const a of assignees) {
      if (a.staff_id) bucket.add(a.staff_id);
    }
    staffByDay.set(dayKey, bucket);
  }
  const counts = new Map<string, number>();
  for (const [dayKey, ids] of staffByDay) {
    counts.set(dayKey, ids.size);
  }
  return counts;
}

function eventTitleFromReservation(row: ReservationListRow): string {
  return (
    reservationGuestDisplayName(
      row.guest_first_name,
      row.guest_last_name,
      row.guest_company,
    ) || "Veranstaltung"
  );
}

/** Veranstaltungen mit Team-Zuweisung für einen Kalendertag. */
export async function fetchReservationDayEventStaffGroups(
  restaurantId: string,
  dayKey: string,
  timeZone: string,
): Promise<{ data: ReservationDayEventStaffGroup[]; error: string | null }> {
  const { start, end } = restaurantDayBoundsIso(dayKey, timeZone);
  const [reservationsRes, shiftsRes] = await Promise.all([
    fetchReservationsForRestaurant({
      restaurantId,
      rangeStartIso: start,
      rangeEndExclusiveIso: end,
    }),
    fetchScheduledShiftsInRange(restaurantId, start, end),
  ]);

  if (reservationsRes.error) {
    return { data: [], error: reservationsRes.error.message };
  }
  if (shiftsRes.error) {
    return { data: [], error: shiftsRes.error };
  }

  const shifts = (shiftsRes.data ?? []).filter((s) => s.status !== "declined");
  const groups: ReservationDayEventStaffGroup[] = [];

  for (const row of reservationsRes.data) {
    if (!isPrivateEventReservation(row)) continue;
    const assignees = row.assigned_staff ?? [];
    if (assignees.length === 0) continue;

    const entries: ReservationDayEventStaffEntry[] = assignees.map((a) => {
      const family = a.family_name?.trim() ?? "";
      const given = a.given_name?.trim() ?? "";
      const name =
        family && given
          ? `${family}, ${given}`
          : family || given || "Mitarbeiter";
      const overlapsShift = shifts.some(
        (shift) =>
          shift.staff_id === a.staff_id &&
          scheduledShiftRangesOverlap(
            { startsAt: row.starts_at, endsAt: row.ends_at },
            { startsAt: shift.starts_at, endsAt: shift.ends_at },
          ),
      );
      return {
        staffId: a.staff_id,
        name,
        overlapsShift,
      };
    });

    entries.sort((a, b) => a.name.localeCompare(b.name, "de"));

    groups.push({
      reservationId: row.id,
      eventTitle: eventTitleFromReservation(row),
      timeLabel: formatShiftTimeRangeDe(row.starts_at, row.ends_at),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      color: PRIVATE_EVENT_STRIPE_HEX,
      entries,
    });
  }

  groups.sort((a, b) => {
    const byStart = a.startsAt.localeCompare(b.startsAt);
    if (byStart !== 0) return byStart;
    return a.eventTitle.localeCompare(b.eventTitle, "de");
  });

  return { data: groups, error: null };
}

export function countUniqueEventStaffIds(
  groups: readonly ReservationDayEventStaffGroup[],
): number {
  const ids = new Set<string>();
  for (const group of groups) {
    for (const entry of group.entries) {
      ids.add(entry.staffId);
    }
  }
  return ids.size;
}
