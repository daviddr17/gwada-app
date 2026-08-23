import { clusterLegacyWorkBreakShifts } from "@/lib/staff/staff-work-hours-display";
import { localDayKey } from "@/lib/staff/shift-schedule-range";
import { isShiftPlanAbsenceEntry } from "@/lib/staff/shift-plan-absence";
import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";

function sameDayTimedEntries(
  siblings: readonly RestaurantStaffWorkEntryRow[],
  staffId: string,
  dayKey: string,
): RestaurantStaffWorkEntryRow[] {
  return siblings.filter((entry) => {
    if (entry.staff_id !== staffId) return false;
    if (isShiftPlanAbsenceEntry(entry)) return false;
    return localDayKey(new Date(entry.starts_at)) === dayKey;
  });
}

/** Segmente einer Display-/Legacy-Schicht (Arbeit + Pause, gleiche `shift_id` oder Legacy-Cluster). */
export function staffWorkShiftClusterSegments(
  entry: RestaurantStaffWorkEntryRow,
  siblings: readonly RestaurantStaffWorkEntryRow[],
): RestaurantStaffWorkEntryRow[] {
  const dayKey = localDayKey(new Date(entry.starts_at));
  const dayEntries = sameDayTimedEntries(siblings, entry.staff_id, dayKey);

  if (entry.shift_id) {
    return dayEntries.filter((e) => e.shift_id === entry.shift_id);
  }

  const legacyItems = clusterLegacyWorkBreakShifts(
    dayEntries.filter(
      (e) => e.entry_type === "work" || e.entry_type === "break",
    ),
  );
  for (const item of legacyItems) {
    if (item.kind !== "display_shift") continue;
    if (item.segments.some((s) => s.id === entry.id)) {
      return item.segments;
    }
  }

  return [entry];
}

export function staffWorkEntriesSameShiftCluster(
  a: RestaurantStaffWorkEntryRow,
  b: RestaurantStaffWorkEntryRow,
  siblings: readonly RestaurantStaffWorkEntryRow[],
): boolean {
  if (a.staff_id !== b.staff_id) return false;
  if (localDayKey(new Date(a.starts_at)) !== localDayKey(new Date(b.starts_at))) {
    return false;
  }
  if (a.shift_id && b.shift_id) return a.shift_id === b.shift_id;

  const clusterA = staffWorkShiftClusterSegments(a, siblings);
  return clusterA.some((s) => s.id === b.id);
}
