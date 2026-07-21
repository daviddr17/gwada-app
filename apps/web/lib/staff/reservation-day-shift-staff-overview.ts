import {
  fetchScheduledShiftsInRange,
} from "@/lib/supabase/staff-shift-schedule-db";
import {
  fetchStaffForRestaurant,
  loadStaffPositionTags,
} from "@/lib/supabase/staff-db";
import { restaurantDayBoundsIso } from "@/lib/restaurant/restaurant-timezone";
import { staffDisplayName } from "@/lib/types/staff";
import type { StaffPositionTagDefinition } from "@/lib/types/staff";
import {
  formatShiftTimeRangeDe,
  type StaffScheduledShiftStatus,
} from "@/lib/types/staff-shift-schedule";

const UNASSIGNED_COLOR = "#64748b";

export type ReservationDayShiftStaffEntry = {
  shiftId: string;
  staffId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  timeLabel: string;
  status: StaffScheduledShiftStatus;
};

export type ReservationDayShiftStaffGroup = {
  positionId: string | null;
  positionName: string;
  positionColor: string;
  entries: ReservationDayShiftStaffEntry[];
};

function resolvePosition(
  positionTagId: string | null,
  tagsById: Map<string, StaffPositionTagDefinition>,
): { id: string | null; name: string; color: string } {
  if (!positionTagId) {
    return { id: null, name: "Ohne Position", color: UNASSIGNED_COLOR };
  }
  const tag = tagsById.get(positionTagId);
  return {
    id: positionTagId,
    name: tag?.name ?? "Ohne Position",
    color: tag?.backgroundColor ?? UNASSIGNED_COLOR,
  };
}

/** Geplante Schichten eines Tages, gruppiert nach Einsatzbereich (Position). */
export async function fetchReservationDayShiftStaffOverview(
  restaurantId: string,
  dayKey: string,
  timeZone: string,
): Promise<{ data: ReservationDayShiftStaffGroup[]; error: string | null }> {
  const { start, end } = restaurantDayBoundsIso(dayKey, timeZone);
  const [shiftsRes, staffRes, tagsRes] = await Promise.all([
    fetchScheduledShiftsInRange(restaurantId, start, end),
    fetchStaffForRestaurant(restaurantId),
    loadStaffPositionTags(restaurantId),
  ]);

  const error = shiftsRes.error ?? staffRes.error ?? tagsRes.error;
  if (error) return { data: [], error };

  const staffById = new Map(staffRes.data.map((s) => [s.id, s]));
  const tagsById = new Map(tagsRes.data.map((t) => [t.id, t]));
  const tagOrder = new Map(tagsRes.data.map((t, index) => [t.id, index]));

  type Bucket = {
    positionId: string | null;
    positionName: string;
    positionColor: string;
    entries: ReservationDayShiftStaffEntry[];
  };
  const buckets = new Map<string, Bucket>();

  for (const shift of shiftsRes.data) {
    if (shift.status === "declined") continue;
    const staff = staffById.get(shift.staff_id);
    const positionTagId =
      staff?.position_tag_id ?? shift.position_tag_id ?? null;
    const position = resolvePosition(positionTagId, tagsById);
    const key = position.id ?? "__none__";
    const bucket = buckets.get(key) ?? {
      positionId: position.id,
      positionName: position.name,
      positionColor: position.color,
      entries: [],
    };
    bucket.entries.push({
      shiftId: shift.id,
      staffId: shift.staff_id,
      name: staff
        ? staffDisplayName(staff)
        : "Unbekannter Mitarbeiter",
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      timeLabel: formatShiftTimeRangeDe(shift.starts_at, shift.ends_at),
      status: shift.status,
    });
    buckets.set(key, bucket);
  }

  const groups = [...buckets.values()].map((group) => ({
    ...group,
    entries: [...group.entries].sort((a, b) => {
      const byStart = a.startsAt.localeCompare(b.startsAt);
      if (byStart !== 0) return byStart;
      return a.name.localeCompare(b.name, "de");
    }),
  }));

  groups.sort((a, b) => {
    if (a.positionId == null && b.positionId != null) return 1;
    if (a.positionId != null && b.positionId == null) return -1;
    if (a.positionId == null && b.positionId == null) return 0;
    const orderA = tagOrder.get(a.positionId!) ?? Number.MAX_SAFE_INTEGER;
    const orderB = tagOrder.get(b.positionId!) ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.positionName.localeCompare(b.positionName, "de");
  });

  return { data: groups, error: null };
}
