import { startOfLocalDay } from "@/lib/reservations/month-range";
import { localDayKey } from "@/lib/staff/shift-schedule-range";
import type { RestaurantStaffWorkEntryRow, StaffWorkEntryType } from "@/lib/types/staff";
import { STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";

export type ShiftPlanAbsenceEntryType = Extract<
  StaffWorkEntryType,
  "vacation" | "sick"
>;

/** Farben im Schichtplan (Urlaub blau, Krank gelb). */
export const SHIFT_PLAN_ABSENCE_COLORS: Record<ShiftPlanAbsenceEntryType, string> = {
  vacation: "#3b82f6",
  sick: "#eab308",
};

export const SHIFT_PLAN_ABSENCE_PRESETS: readonly {
  entryType: ShiftPlanAbsenceEntryType;
  label: string;
  color: string;
}[] = [
  {
    entryType: "vacation",
    label: STAFF_WORK_ENTRY_LABELS.vacation,
    color: SHIFT_PLAN_ABSENCE_COLORS.vacation,
  },
  {
    entryType: "sick",
    label: STAFF_WORK_ENTRY_LABELS.sick,
    color: SHIFT_PLAN_ABSENCE_COLORS.sick,
  },
];

/** Ganztägiger Urlaub/Krank-Eintrag für einen lokalen Kalendertag. */
export function absenceEntryRangeForLocalDay(day: Date): {
  starts_at: string;
  ends_at: string;
} {
  const start = startOfLocalDay(day);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

export function isShiftPlanAbsenceEntry(
  entry: RestaurantStaffWorkEntryRow,
): entry is RestaurantStaffWorkEntryRow & {
  entry_type: ShiftPlanAbsenceEntryType;
} {
  return entry.entry_type === "vacation" || entry.entry_type === "sick";
}

export function buildAbsenceMaps(
  entries: readonly RestaurantStaffWorkEntryRow[],
): Map<string, RestaurantStaffWorkEntryRow[]> {
  const map = new Map<string, RestaurantStaffWorkEntryRow[]>();
  for (const entry of entries) {
    if (!isShiftPlanAbsenceEntry(entry)) continue;
    const dayKey = localDayKey(new Date(entry.starts_at));
    const key = `${entry.staff_id}__${dayKey}`;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  return map;
}

export function findStaffAbsenceOnDay(
  entries: readonly RestaurantStaffWorkEntryRow[],
  staffId: string,
  dayKey: string,
): RestaurantStaffWorkEntryRow | null {
  for (const entry of entries) {
    if (entry.staff_id !== staffId || !isShiftPlanAbsenceEntry(entry)) continue;
    if (localDayKey(new Date(entry.starts_at)) === dayKey) return entry;
  }
  return null;
}

/** Arbeitszeit/Pause — an Urlaubs- oder Krankheitstagen nicht erlaubt. */
export function isStaffWorkTimeEntryType(entryType: StaffWorkEntryType): boolean {
  return entryType === "work" || entryType === "break";
}

export function buildAbsenceDayKeys(
  entries: readonly RestaurantStaffWorkEntryRow[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const entry of entries) {
    if (!isShiftPlanAbsenceEntry(entry)) continue;
    keys.add(localDayKey(new Date(entry.starts_at)));
  }
  return keys;
}

export function absenceBlocksWorkTimeMessage(
  entryType: ShiftPlanAbsenceEntryType,
): string {
  return `${STAFF_WORK_ENTRY_LABELS[entryType]} an diesem Tag — keine Arbeitszeit eintragbar.`;
}
