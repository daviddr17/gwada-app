import type { RestaurantStaffRow } from "@/lib/types/staff";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";
import type { ShiftPlanPositionGroup } from "@/lib/staff/shift-plan-position-groups";

export type ShiftPlanDayPositionCount = {
  positionId: string | null;
  name: string;
  color: string;
  /** Einzigartige Mitarbeiter mit ≥1 nicht abgelehnter Schicht. */
  staffCount: number;
};

function staffHasPlannedShift(
  staffId: string,
  dayKey: string,
  shiftsByCell: ReadonlyMap<string, readonly RestaurantStaffScheduledShiftRow[]>,
): boolean {
  const shifts = shiftsByCell.get(`${staffId}__${dayKey}`) ?? [];
  return shifts.some((shift) => shift.status !== "declined");
}

/** Geplante Mitarbeiter einer Position (Gruppen-Staff) an einem Tag. */
export function countPlannedStaffForGroupDay(
  staffRows: readonly RestaurantStaffRow[],
  dayKey: string,
  shiftsByCell: ReadonlyMap<string, readonly RestaurantStaffScheduledShiftRow[]>,
): number {
  let count = 0;
  for (const staff of staffRows) {
    if (staffHasPlannedShift(staff.id, dayKey, shiftsByCell)) count += 1;
  }
  return count;
}

/** Alle Positionen mit geplanten Mitarbeitern an einem Tag (nur count > 0). */
export function countPlannedStaffByPositionForDay(
  groups: readonly ShiftPlanPositionGroup[],
  dayKey: string,
  shiftsByCell: ReadonlyMap<string, readonly RestaurantStaffScheduledShiftRow[]>,
): ShiftPlanDayPositionCount[] {
  const out: ShiftPlanDayPositionCount[] = [];
  for (const group of groups) {
    const staffCount = countPlannedStaffForGroupDay(
      group.staff,
      dayKey,
      shiftsByCell,
    );
    if (staffCount === 0) continue;
    out.push({
      positionId: group.id,
      name: group.name,
      color: group.color,
      staffCount,
    });
  }
  return out;
}
