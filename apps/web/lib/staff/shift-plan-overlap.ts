import { localDayKey } from "@/lib/staff/shift-schedule-range";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";

/** Halboffen: 06–14 und 14–22 überschneiden sich nicht. */
export function scheduledShiftRangesOverlap(
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string },
): boolean {
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = new Date(b.endsAt).getTime();
  if (
    !Number.isFinite(aStart) ||
    !Number.isFinite(aEnd) ||
    !Number.isFinite(bStart) ||
    !Number.isFinite(bEnd)
  ) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
}

export function clockTimesFromScheduledShift(shift: {
  starts_at: string;
  ends_at: string;
}): { startTime: string; endTime: string } {
  const start = new Date(shift.starts_at);
  const end = new Date(shift.ends_at);
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
  return { startTime: fmt(start), endTime: fmt(end) };
}

export function findOverlappingScheduledShift(
  candidate: { startsAt: string; endsAt: string },
  existing: RestaurantStaffScheduledShiftRow[],
  opts?: {
    staffId: string;
    dayKey?: string;
    excludeShiftId?: string;
  },
): RestaurantStaffScheduledShiftRow | null {
  for (const shift of existing) {
    if (opts?.staffId && shift.staff_id !== opts.staffId) continue;
    if (opts?.excludeShiftId && shift.id === opts.excludeShiftId) continue;
    if (opts?.dayKey) {
      const shiftDay = localDayKey(new Date(shift.starts_at));
      if (shiftDay !== opts.dayKey) continue;
    }
    if (
      scheduledShiftRangesOverlap(candidate, {
        startsAt: shift.starts_at,
        endsAt: shift.ends_at,
      })
    ) {
      return shift;
    }
  }
  return null;
}

export function formatShiftPlanWeekApplyToast(params: {
  created: number;
  skippedAbsence: number;
  skippedOverlap: number;
  multiDay: boolean;
}): { type: "success" | "error" | "info"; message: string } {
  const { created, skippedAbsence, skippedOverlap, multiDay } = params;
  const skipped = skippedAbsence + skippedOverlap;

  if (created === 0) {
    if (skippedOverlap > 0 && skippedAbsence === 0) {
      return {
        type: "error",
        message: multiDay
          ? "Keine Schichten geplant — an allen Tagen Überschneidungen."
          : "Zu dieser Zeit gibt es bereits eine Schicht.",
      };
    }
    if (skippedAbsence > 0 && skippedOverlap === 0) {
      return {
        type: "error",
        message: multiDay
          ? "An diesen Tagen ist bereits Urlaub/Krank eingetragen."
          : "An diesem Tag ist bereits eine Abwesenheit eingetragen.",
      };
    }
    if (skipped > 0) {
      return {
        type: "error",
        message: multiDay
          ? "Keine Schichten geplant — Abwesenheit oder Überschneidung."
          : "Schicht konnte nicht geplant werden.",
      };
    }
    return { type: "error", message: "Schicht konnte nicht geplant werden." };
  }

  if (!multiDay) {
    return { type: "success", message: "Schicht geplant." };
  }

  const parts: string[] = [
    `${created} Schicht${created === 1 ? "" : "en"} für die Woche geplant.`,
  ];
  if (skippedAbsence > 0) {
    parts.push(
      `${skippedAbsence} Tag${skippedAbsence === 1 ? "" : "e"} wegen Abwesenheit übersprungen`,
    );
  }
  if (skippedOverlap > 0) {
    parts.push(
      `${skippedOverlap} Tag${skippedOverlap === 1 ? "" : "e"} wegen Überschneidung übersprungen`,
    );
  }
  return {
    type: skipped > 0 ? "info" : "success",
    message: parts.length === 1 ? parts[0]! : `${parts[0]} · ${parts.slice(1).join(" · ")}`,
  };
}
