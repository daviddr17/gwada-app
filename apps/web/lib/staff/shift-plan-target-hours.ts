import type { ShiftScheduleViewMode } from "@/lib/types/staff-shift-schedule";
import type { RestaurantStaffContractRow } from "@/lib/types/staff";
import {
  findStaffContractForDay,
  staffContractDateYmd,
} from "@/lib/staff/staff-day-wage";
import { formatScheduledHoursMinutes } from "@/lib/types/staff-shift-schedule";
import { localDayKey } from "@/lib/staff/shift-schedule-range";

const OPEN_CONTRACT_END = "9999-12-31";

export function formatShiftPlanHoursLine(
  plannedMinutes: number,
  targetMinutes: number | null,
): string {
  const plannedLabel = formatScheduledHoursMinutes(plannedMinutes);
  if (targetMinutes != null && targetMinutes > 0) {
    return `${plannedLabel} / ${formatScheduledHoursMinutes(targetMinutes)} geplant`;
  }
  return `${plannedLabel} geplant`;
}

/** Soll-Minuten für Anzeige (Vertrag → skaliert auf sichtbare Ansicht). */
export function resolveShiftPlanStaffTargetMinutes(
  contracts: readonly RestaurantStaffContractRow[],
  staffId: string,
  visibleDays: readonly Date[],
  view: ShiftScheduleViewMode,
): number | null {
  const weekly = staffTargetWeeklyMinutesInView(contracts, staffId, visibleDays);
  if (weekly == null) return null;
  return scaleWeeklyTargetMinutesToView(weekly, view, visibleDays.length);
}

function contractRangeEnd(validTo: string | null): string {
  return staffContractDateYmd(validTo) ?? OPEN_CONTRACT_END;
}

function contractTargetWeeklyMinutes(
  contract: RestaurantStaffContractRow | null | undefined,
): number | null {
  const raw = contract?.target_weekly_minutes;
  if (raw == null) return null;
  const minutes = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round(minutes);
}

/** Wochen-Soll auf sichtbaren Zeitraum umrechnen (Tag ≈ 1/7, Monat ≈ Tage/7). */
export function scaleWeeklyTargetMinutesToView(
  weeklyMinutes: number,
  view: ShiftScheduleViewMode,
  visibleDayCount: number,
): number {
  if (view === "week") return weeklyMinutes;
  if (view === "day") return Math.round(weeklyMinutes / 7);
  return Math.round((weeklyMinutes * visibleDayCount) / 7);
}

export function staffTargetWeeklyMinutes(
  contracts: readonly RestaurantStaffContractRow[],
  staffId: string,
  referenceDay: Date,
): number | null {
  return staffTargetWeeklyMinutesInView(contracts, staffId, [referenceDay]);
}

/** Aktiver Vertrag mit Soll-Zeit im sichtbaren Zeitraum (heute bevorzugt). */
export function staffTargetWeeklyMinutesInView(
  contracts: readonly RestaurantStaffContractRow[],
  staffId: string,
  visibleDays: readonly Date[],
): number | null {
  if (visibleDays.length === 0) return staffNewestTargetWeeklyMinutes(contracts, staffId);

  const todayKey = localDayKey(new Date());
  const dayKeys: string[] = [];
  const seen = new Set<string>();
  for (const day of visibleDays) {
    const key = localDayKey(day);
    if (seen.has(key)) continue;
    seen.add(key);
    dayKeys.push(key);
  }
  dayKeys.sort((a, b) => {
    if (a === todayKey) return -1;
    if (b === todayKey) return 1;
    return a.localeCompare(b);
  });

  for (const dayYmd of dayKeys) {
    const contract = findStaffContractForDay(contracts, staffId, dayYmd);
    if (!contract) continue;
    const minutes = contractTargetWeeklyMinutes(contract);
    if (minutes != null) return minutes;
  }

  return staffNewestTargetWeeklyMinutes(contracts, staffId);
}

/** Neuester Vertrag mit Soll-Zeit (Fallback, wenn Tagesabgleich scheitert). */
export function staffNewestTargetWeeklyMinutes(
  contracts: readonly RestaurantStaffContractRow[],
  staffId: string,
): number | null {
  let best: RestaurantStaffContractRow | null = null;
  for (const contract of contracts) {
    if (contract.staff_id !== staffId) continue;
    const minutes = contractTargetWeeklyMinutes(contract);
    if (minutes == null) continue;
    if (
      !best ||
      contract.valid_from.localeCompare(best.valid_from) > 0
    ) {
      best = contract;
    }
  }
  return contractTargetWeeklyMinutes(best);
}

export function buildStaffTargetMinutesForView(
  contracts: readonly RestaurantStaffContractRow[],
  staffIds: readonly string[],
  visibleDays: readonly Date[],
  view: ShiftScheduleViewMode,
): Map<string, number> {
  const visibleDayCount = visibleDays.length;
  const map = new Map<string, number>();
  for (const staffId of staffIds) {
    const weekly = staffTargetWeeklyMinutesInView(
      contracts,
      staffId,
      visibleDays,
    );
    if (weekly == null) continue;
    map.set(
      staffId,
      scaleWeeklyTargetMinutesToView(weekly, view, visibleDayCount),
    );
  }
  return map;
}

export type ShiftPlanTargetStatus = "none" | "ok" | "near" | "under";

export function evaluateShiftPlanTarget(
  plannedMinutes: number,
  targetMinutes: number | null,
): {
  status: ShiftPlanTargetStatus;
  remainingMinutes: number;
  progressPercent: number;
  sollLine: string | null;
  statusClassName: string;
} {
  if (targetMinutes == null || targetMinutes <= 0) {
    return {
      status: "none",
      remainingMinutes: 0,
      progressPercent: 0,
      sollLine: null,
      statusClassName: "text-muted-foreground",
    };
  }

  const remainingMinutes = Math.max(0, targetMinutes - plannedMinutes);
  const ratio = plannedMinutes / targetMinutes;
  const progressPercent = Math.min(100, ratio * 100);
  const sollLabel = formatScheduledHoursMinutes(targetMinutes);

  let status: ShiftPlanTargetStatus;
  let statusClassName: string;
  if (ratio >= 0.92) {
    status = "ok";
    statusClassName = "text-emerald-700 dark:text-emerald-400";
  } else if (ratio >= 0.75) {
    status = "near";
    statusClassName = "text-muted-foreground";
  } else {
    status = "under";
    statusClassName = "text-red-600 dark:text-red-400";
  }

  let sollLine: string;
  if (remainingMinutes <= 0) {
    sollLine =
      ratio > 1.08
        ? `${formatScheduledHoursMinutes(plannedMinutes - targetMinutes)} über · ${sollLabel} Soll`
        : `Soll erreicht · ${sollLabel} Soll`;
  } else {
    sollLine = `${formatScheduledHoursMinutes(remainingMinutes)} fehlt · ${sollLabel} Soll`;
  }

  return {
    status,
    remainingMinutes,
    progressPercent,
    sollLine,
    statusClassName,
  };
}

export function progressBarMaxMinutes(
  plannedMinutes: number,
  targetMinutes: number | null,
): number {
  if (targetMinutes != null && targetMinutes > 0) {
    return Math.max(targetMinutes, plannedMinutes, 1);
  }
  return Math.max(plannedMinutes, 1);
}
