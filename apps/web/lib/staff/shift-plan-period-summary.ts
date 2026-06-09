import {
  findStaffContractForDay,
  formatStaffEuroCents,
} from "@/lib/staff/staff-day-wage";
import { localDayKey } from "@/lib/staff/shift-schedule-range";
import type { RestaurantStaffContractRow } from "@/lib/types/staff";
import type { RestaurantStaffScheduledShiftRow } from "@/lib/types/staff-shift-schedule";
import { scheduledShiftDurationMinutes } from "@/lib/types/staff-shift-schedule";

export type ShiftPlanPeriodSummary = {
  plannedMinutes: number;
  shiftCount: number;
  wageCents: number;
  hourlyShiftCount: number;
  fixedPayShiftCount: number;
  /** Kein gültiger Vertrag am Schichttag. */
  missingContractShiftCount: number;
  /** Vertrag vorhanden, aber kein Stundenlohn hinterlegt. */
  missingHourlyRateShiftCount: number;
};

export function computeShiftPlanPeriodSummary(params: {
  shifts: readonly RestaurantStaffScheduledShiftRow[];
  contracts: readonly RestaurantStaffContractRow[];
  visibleDays: readonly Date[];
}): ShiftPlanPeriodSummary {
  const visibleDayKeys = new Set(
    params.visibleDays.map((d) => localDayKey(d)),
  );

  let plannedMinutes = 0;
  let shiftCount = 0;
  let wageCents = 0;
  let hourlyShiftCount = 0;
  let fixedPayShiftCount = 0;
  let missingContractShiftCount = 0;
  let missingHourlyRateShiftCount = 0;

  for (const shift of params.shifts) {
    const dayKey = localDayKey(new Date(shift.starts_at));
    if (!visibleDayKeys.has(dayKey)) continue;

    const minutes = scheduledShiftDurationMinutes(
      shift.starts_at,
      shift.ends_at,
    );
    if (minutes <= 0) continue;

    shiftCount += 1;
    plannedMinutes += minutes;

    const contract = findStaffContractForDay(
      params.contracts,
      shift.staff_id,
      dayKey,
    );

    if (!contract) {
      missingContractShiftCount += 1;
      continue;
    }

    if (contract.pay_type === "fixed") {
      fixedPayShiftCount += 1;
      continue;
    }

    const hourlyRateCents = contract.hourly_rate_cents;
    if (hourlyRateCents == null || hourlyRateCents <= 0) {
      missingHourlyRateShiftCount += 1;
      continue;
    }

    hourlyShiftCount += 1;
    wageCents += Math.round((minutes / 60) * hourlyRateCents);
  }

  return {
    plannedMinutes,
    shiftCount,
    wageCents,
    hourlyShiftCount,
    fixedPayShiftCount,
    missingContractShiftCount,
    missingHourlyRateShiftCount,
  };
}

export function shiftPlanPeriodCoverageNotes(
  summary: ShiftPlanPeriodSummary,
): string[] {
  const notes: string[] = [];
  if (summary.missingContractShiftCount > 0) {
    const n = summary.missingContractShiftCount;
    notes.push(
      `${n} ${n === 1 ? "Schicht" : "Schichten"} ohne Vertrag`,
    );
  }
  if (summary.missingHourlyRateShiftCount > 0) {
    const n = summary.missingHourlyRateShiftCount;
    notes.push(
      `${n} ${n === 1 ? "Schicht" : "Schichten"} ohne Lohnangabe`,
    );
  }
  if (summary.fixedPayShiftCount > 0) {
    const n = summary.fixedPayShiftCount;
    notes.push(
      `${n} ${n === 1 ? "Schicht" : "Schichten"} Festlohn (nicht in Summe)`,
    );
  }
  return notes;
}

export function shiftPlanPeriodWageHint(summary: ShiftPlanPeriodSummary): string | null {
  const notes = shiftPlanPeriodCoverageNotes(summary);
  if (notes.length === 0) return null;
  return notes.join(" · ");
}

export function shiftPlanPeriodWageLabel(summary: ShiftPlanPeriodSummary): string {
  if (summary.hourlyShiftCount === 0 && summary.wageCents === 0) {
    if (summary.fixedPayShiftCount > 0 && summary.shiftCount > 0) {
      return "Festlohn — nicht zeitraumbasiert";
    }
    if (
      summary.shiftCount > 0 &&
      summary.missingContractShiftCount + summary.missingHourlyRateShiftCount ===
        summary.shiftCount
    ) {
      return "Kein Stundenlohn hinterlegt";
    }
    return formatStaffEuroCents(0);
  }
  return formatStaffEuroCents(summary.wageCents);
}
