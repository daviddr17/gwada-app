import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantDayBoundsIso,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";
import { scheduledShiftRangesOverlap } from "@/lib/staff/shift-plan-overlap";
import { fetchScheduledShiftsInRange } from "@/lib/supabase/staff-shift-schedule-db";
import { fetchStaffForRestaurant } from "@/lib/supabase/staff-db";
import { staffDisplayName } from "@/lib/types/staff";
import { formatShiftTimeRangeDe } from "@/lib/types/staff-shift-schedule";

export type EventStaffShiftOverlap = {
  staffId: string;
  staffName: string;
  shiftTimeLabel: string;
};

/**
 * Findet Schichtplan-Überschneidungen für Veranstaltungs-Mitarbeiter
 * im Zeitraum der Veranstaltung.
 *
 * Lädt Schichten des Restaurant-Kalendertags (nicht nur starts_at im
 * Event-Fenster), damit frühere Schichten mit Überlappung nicht fehlen.
 */
export async function findEventAssigneeShiftOverlaps(params: {
  restaurantId: string;
  startsAt: string;
  endsAt: string;
  staffIds: readonly string[];
  timeZone?: string;
}): Promise<{ overlaps: EventStaffShiftOverlap[]; error: string | null }> {
  const uniqueIds = [...new Set(params.staffIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { overlaps: [], error: null };
  }

  const timeZone = params.timeZone ?? DEFAULT_RESTAURANT_TIMEZONE;
  const startDayKey = restaurantZonedDateKey(
    new Date(params.startsAt),
    timeZone,
  );
  const endDayKey = restaurantZonedDateKey(new Date(params.endsAt), timeZone);
  const { start } = restaurantDayBoundsIso(startDayKey, timeZone);
  const { end } = restaurantDayBoundsIso(endDayKey, timeZone);

  const [shiftsRes, staffRes] = await Promise.all([
    fetchScheduledShiftsInRange(params.restaurantId, start, end),
    fetchStaffForRestaurant(params.restaurantId),
  ]);

  if (shiftsRes.error) {
    return { overlaps: [], error: shiftsRes.error };
  }
  if (staffRes.error) {
    return { overlaps: [], error: staffRes.error };
  }

  const staffById = new Map(staffRes.data.map((s) => [s.id, s]));
  const wanted = new Set(uniqueIds);
  const overlaps: EventStaffShiftOverlap[] = [];

  for (const shift of shiftsRes.data) {
    if (shift.status === "declined") continue;
    if (!wanted.has(shift.staff_id)) continue;
    if (
      !scheduledShiftRangesOverlap(
        { startsAt: params.startsAt, endsAt: params.endsAt },
        { startsAt: shift.starts_at, endsAt: shift.ends_at },
      )
    ) {
      continue;
    }
    const staff = staffById.get(shift.staff_id);
    overlaps.push({
      staffId: shift.staff_id,
      staffName: staff ? staffDisplayName(staff) : "Mitarbeiter",
      shiftTimeLabel: formatShiftTimeRangeDe(shift.starts_at, shift.ends_at),
    });
  }

  overlaps.sort((a, b) => {
    const byName = a.staffName.localeCompare(b.staffName, "de");
    if (byName !== 0) return byName;
    return a.shiftTimeLabel.localeCompare(b.shiftTimeLabel, "de");
  });

  return { overlaps, error: null };
}
