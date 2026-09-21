import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { restaurantIsoToYmdHm } from "@/lib/restaurant/restaurant-timezone";
import {
  analyzeStaffDayWork,
  addDaysToYmd,
  mondayOfWeekYmd,
  type DayWorkAnalysis,
  type LaborComplianceViolation,
} from "@/lib/staff/labor-law/de-arbzg-rules";
import {
  evaluateDeArbzgDay,
  evaluateDeArbzgRestCompensation,
  evaluateDeArbzgRestPeriod,
  evaluateDeArbzgSixMonthAverage,
  evaluateDeArbzgWeekly,
} from "@/lib/staff/labor-law/de-arbzg-evaluators";
import { resolveRestaurantCountryProfile } from "@/lib/restaurant/country-profile";

function dayYmdInZone(iso: string, timeZone: string): string {
  return restaurantIsoToYmdHm(iso, timeZone).ymd;
}

export type EvaluateLaborComplianceParams = {
  entries: RestaurantStaffWorkEntryRow[];
  countryIso2?: string | null;
  countryLabel?: string | null;
  timeZone: string;
  closedOnly?: boolean;
  fromYmd?: string;
  toYmd?: string;
};

function groupEntriesByStaffDay(
  entries: RestaurantStaffWorkEntryRow[],
  timeZone: string,
  closedOnly: boolean,
): Map<string, RestaurantStaffWorkEntryRow[]> {
  const byStaffDay = new Map<string, RestaurantStaffWorkEntryRow[]>();
  for (const e of entries) {
    if (closedOnly && (e.is_open || !e.ends_at)) continue;
    if (e.entry_type !== "work" && e.entry_type !== "break") continue;
    const dayYmd = dayYmdInZone(e.starts_at, timeZone);
    const key = `${e.staff_id}:${dayYmd}`;
    const list = byStaffDay.get(key) ?? [];
    list.push(e);
    byStaffDay.set(key, list);
  }
  return byStaffDay;
}

function analysesFromGroups(
  byStaffDay: Map<string, RestaurantStaffWorkEntryRow[]>,
): DayWorkAnalysis[] {
  const analyses: DayWorkAnalysis[] = [];
  for (const [key, dayEntries] of byStaffDay) {
    const [staffId, dayYmd] = key.split(":");
    const analysis = analyzeStaffDayWork({
      staffId: staffId!,
      dayYmd: dayYmd!,
      workEntries: dayEntries.filter((e) => e.entry_type === "work"),
      breakEntries: dayEntries.filter((e) => e.entry_type === "break"),
    });
    if (analysis) analyses.push(analysis);
  }
  return analyses;
}

export function evaluateLaborCompliance(
  params: EvaluateLaborComplianceParams,
): LaborComplianceViolation[] {
  const profile = resolveRestaurantCountryProfile({
    countryIso2: params.countryIso2,
    countryLabel: params.countryLabel,
  });
  if (profile.laborLaw?.engineId !== "de-arbzg") {
    return [];
  }

  const closedOnly = params.closedOnly !== false;
  const allGroups = groupEntriesByStaffDay(
    params.entries,
    params.timeZone,
    closedOnly,
  );
  const allAnalyses = analysesFromGroups(allGroups);

  const inRange = allAnalyses.filter((a) => {
    if (params.fromYmd && a.dayYmd < params.fromYmd) return false;
    if (params.toYmd && a.dayYmd > params.toYmd) return false;
    return true;
  });

  const violations: LaborComplianceViolation[] = [];
  const seenWeekly = new Set<string>();

  for (const analysis of inRange) {
    violations.push(...evaluateDeArbzgDay(analysis));

    const avgViolation = evaluateDeArbzgSixMonthAverage({
      staffId: analysis.staffId,
      dayYmd: analysis.dayYmd,
      analyses: allAnalyses,
    });
    if (avgViolation) violations.push(avgViolation);

    const weekMonday = mondayOfWeekYmd(analysis.dayYmd);
    const weekKey = `${analysis.staffId}:${weekMonday}`;
    if (!seenWeekly.has(weekKey)) {
      seenWeekly.add(weekKey);
      const weekViolation = evaluateDeArbzgWeekly({
        staffId: analysis.staffId,
        weekMondayYmd: weekMonday,
        analyses: allAnalyses,
      });
      if (weekViolation) violations.push(weekViolation);
    }
  }

  const byStaff = new Map<string, RestaurantStaffWorkEntryRow[]>();
  for (const e of params.entries) {
    if (closedOnly && (e.is_open || !e.ends_at)) continue;
    if (e.entry_type !== "work") continue;
    const list = byStaff.get(e.staff_id) ?? [];
    list.push(e);
    byStaff.set(e.staff_id, list);
  }

  const restBoundaries: Parameters<typeof evaluateDeArbzgRestCompensation>[0] =
    [];

  for (const [staffId, workList] of byStaff) {
    const sorted = [...workList].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const next = sorted[i]!;
      const prevDay = dayYmdInZone(prev.ends_at, params.timeZone);
      const nextDay = dayYmdInZone(next.starts_at, params.timeZone);
      if (prevDay === nextDay) continue;
      const restMin =
        (new Date(next.starts_at).getTime() - new Date(prev.ends_at).getTime()) /
        60_000;
      restBoundaries.push({
        staffId,
        endIso: prev.ends_at,
        startIso: next.starts_at,
        restMinutes: restMin,
        nextDayYmd: nextDay,
      });
      if (
        (!params.fromYmd || nextDay >= params.fromYmd) &&
        (!params.toYmd || nextDay <= params.toYmd)
      ) {
        const restViolation = evaluateDeArbzgRestPeriod({
          staffId,
          previousDayEndIso: prev.ends_at,
          nextDayStartIso: next.starts_at,
          dayYmd: nextDay,
          gastroShortRestAllowed: true,
        });
        if (restViolation) violations.push(restViolation);
      }
    }
  }

  violations.push(
    ...evaluateDeArbzgRestCompensation(restBoundaries).filter((v) => {
      if (params.fromYmd && v.dayYmd < params.fromYmd) return false;
      if (params.toYmd && v.dayYmd > params.toYmd) return false;
      return true;
    }),
  );

  const dedupe = new Map<string, LaborComplianceViolation>();
  for (const v of violations) {
    const key = `${v.staffId}:${v.dayYmd}:${v.code}:${v.weekLabel ?? ""}`;
    dedupe.set(key, v);
  }

  return [...dedupe.values()].sort((a, b) => {
    const d = b.dayYmd.localeCompare(a.dayYmd);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title);
  });
}

export function laborViolationsForStaffDay(
  violations: LaborComplianceViolation[],
  staffId: string,
  dayYmd: string,
): LaborComplianceViolation[] {
  const weekMonday = mondayOfWeekYmd(dayYmd);
  const weekEnd = addDaysToYmd(weekMonday, 6);
  return violations.filter((v) => {
    if (v.staffId !== staffId) return false;
    if (v.dayYmd === dayYmd) return true;
    if (v.code === "weekly_hours_exceeded") {
      return dayYmd >= weekMonday && dayYmd <= weekEnd;
    }
    return false;
  });
}

export function laborViolationsByDayYmd(
  violations: LaborComplianceViolation[],
  staffId?: string | null,
): Map<string, LaborComplianceViolation[]> {
  const map = new Map<string, LaborComplianceViolation[]>();
  for (const v of violations) {
    if (staffId && v.staffId !== staffId) continue;
    const list = map.get(v.dayYmd) ?? [];
    list.push(v);
    map.set(v.dayYmd, list);
  }
  return map;
}
