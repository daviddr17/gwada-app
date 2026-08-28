import type { RestaurantStaffWorkEntryRow } from "@/lib/types/staff";
import { restaurantIsoToYmdHm } from "@/lib/restaurant/restaurant-timezone";
import {
  analyzeStaffDayWork,
  evaluateDeArbzgDay,
  evaluateDeArbzgRestPeriod,
  type LaborComplianceViolation,
} from "@/lib/staff/labor-law/de-arbzg-rules";
import { resolveRestaurantCountryProfile } from "@/lib/restaurant/country-profile";

function dayYmdInZone(iso: string, timeZone: string): string {
  return restaurantIsoToYmdHm(iso, timeZone).ymd;
}

export type EvaluateLaborComplianceParams = {
  entries: RestaurantStaffWorkEntryRow[];
  countryIso2?: string | null;
  countryLabel?: string | null;
  timeZone: string;
  /** Nur abgeschlossene Einträge (ends_at gesetzt, nicht is_open) */
  closedOnly?: boolean;
  fromYmd?: string;
  toYmd?: string;
};

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
  const byStaffDay = new Map<string, RestaurantStaffWorkEntryRow[]>();

  for (const e of params.entries) {
    if (closedOnly && (e.is_open || !e.ends_at)) continue;
    if (e.entry_type !== "work" && e.entry_type !== "break") continue;
    const dayYmd = dayYmdInZone(e.starts_at, params.timeZone);
    if (params.fromYmd && dayYmd < params.fromYmd) continue;
    if (params.toYmd && dayYmd > params.toYmd) continue;
    const key = `${e.staff_id}:${dayYmd}`;
    const list = byStaffDay.get(key) ?? [];
    list.push(e);
    byStaffDay.set(key, list);
  }

  const violations: LaborComplianceViolation[] = [];

  for (const [key, dayEntries] of byStaffDay) {
    const [staffId, dayYmd] = key.split(":");
    const workEntries = dayEntries.filter((e) => e.entry_type === "work");
    const breakEntries = dayEntries.filter((e) => e.entry_type === "break");
    const analysis = analyzeStaffDayWork({
      staffId: staffId!,
      dayYmd: dayYmd!,
      workEntries,
      breakEntries,
    });
    if (!analysis) continue;
    violations.push(...evaluateDeArbzgDay(analysis));
  }

  // Ruhezeit zwischen aufeinanderfolgenden Tagen
  const byStaff = new Map<string, RestaurantStaffWorkEntryRow[]>();
  for (const e of params.entries) {
    if (closedOnly && (e.is_open || !e.ends_at)) continue;
    if (e.entry_type !== "work") continue;
    const list = byStaff.get(e.staff_id) ?? [];
    list.push(e);
    byStaff.set(e.staff_id, list);
  }

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

  return violations;
}
