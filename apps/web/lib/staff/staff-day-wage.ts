import type {
  RestaurantStaffContractRow,
  RestaurantStaffWorkEntryRow,
} from "@/lib/types/staff";
import { isStaffFixedPayType } from "@/lib/staff/staff-contract-pay";
import { addDays, localDayKey } from "@/lib/staff/shift-schedule-range";
import { startOfLocalDay } from "@/lib/reservations/month-range";

const OPEN_CONTRACT_END = "9999-12-31";

function parseLocalDayYmd(dayYmd: string): Date {
  const [y, m, d] = dayYmd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localDayBoundsMs(dayYmd: string): { startMs: number; endMs: number } {
  const start = startOfLocalDay(parseLocalDayYmd(dayYmd));
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

/** Anteil eines Eintrags, der in den lokalen Kalendertag fällt (00:00–24:00). */
export function staffWorkEntryMsForDay(
  entry: Pick<RestaurantStaffWorkEntryRow, "starts_at" | "ends_at" | "is_open">,
  dayYmd: string,
  now: Date = new Date(),
): number {
  const { startMs: dayStartMs, endMs: dayEndMs } = localDayBoundsMs(dayYmd);
  const entryStartMs = new Date(entry.starts_at).getTime();
  const entryEndMs = entry.is_open
    ? now.getTime()
    : new Date(entry.ends_at).getTime();
  const clipStartMs = Math.max(entryStartMs, dayStartMs);
  const clipEndMs = Math.min(entryEndMs, dayEndMs);
  return Math.max(0, clipEndMs - clipStartMs);
}

/** PostgREST liefert `date` teils als ISO-String — für Vergleiche nur YYYY-MM-DD. */
export function staffContractDateYmd(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return value.slice(0, 10);
}

export function formatStaffEuroCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function contractRangeEnd(validTo: string | null): string {
  return validTo ?? OPEN_CONTRACT_END;
}

export function staffContractActiveOnDay(
  contract: RestaurantStaffContractRow,
  dayYmd: string,
): boolean {
  const from = staffContractDateYmd(contract.valid_from);
  const to = staffContractDateYmd(contractRangeEnd(contract.valid_to));
  if (!from || !to) return false;
  return from <= dayYmd && dayYmd <= to;
}

export function findStaffContractForDay(
  contracts: readonly RestaurantStaffContractRow[],
  staffId: string,
  dayYmd: string,
): RestaurantStaffContractRow | null {
  const matches = contracts.filter(
    (c) => c.staff_id === staffId && staffContractActiveOnDay(c, dayYmd),
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]!;
}

export function sumStaffWorkHoursForDay(
  entries: readonly RestaurantStaffWorkEntryRow[],
  staffId: string,
  dayYmd: string,
  now: Date = new Date(),
): number {
  let workMs = 0;
  let breakMs = 0;
  for (const e of entries) {
    if (e.staff_id !== staffId) continue;
    const ms = staffWorkEntryMsForDay(e, dayYmd, now);
    if (ms <= 0) continue;
    if (e.entry_type === "work") workMs += ms;
    else if (e.entry_type === "break") breakMs += ms;
  }
  return Math.max(0, workMs - breakMs) / 3_600_000;
}

export type StaffDayWageLine = {
  staffId: string;
  workHours: number;
  hourlyRateCents: number | null;
  wageCents: number;
  payType: RestaurantStaffContractRow["pay_type"] | null;
  /** Kurzer Hinweis, wenn kein tagesbasierter Lohn berechnet werden kann. */
  note: string | null;
};

export type StaffDayWageBreakdown = {
  lines: StaffDayWageLine[];
  totalCents: number;
};

export function computeStaffDayWageBreakdown(params: {
  entries: readonly RestaurantStaffWorkEntryRow[];
  contracts: readonly RestaurantStaffContractRow[];
  dayYmd: string;
  now?: Date;
}): StaffDayWageBreakdown {
  const now = params.now ?? new Date();
  const staffIds = new Set<string>();
  for (const e of params.entries) {
    if (e.entry_type === "work") staffIds.add(e.staff_id);
  }

  const lines: StaffDayWageLine[] = [];
  let totalCents = 0;

  for (const staffId of staffIds) {
    const workHours = sumStaffWorkHoursForDay(
      params.entries,
      staffId,
      params.dayYmd,
      now,
    );
    if (workHours <= 0) continue;

    const contract = findStaffContractForDay(
      params.contracts,
      staffId,
      params.dayYmd,
    );

    if (!contract) {
      lines.push({
        staffId,
        workHours,
        hourlyRateCents: null,
        wageCents: 0,
        payType: null,
        note: "Kein gültiger Vertrag",
      });
      continue;
    }

    if (isStaffFixedPayType(contract.pay_type)) {
      lines.push({
        staffId,
        workHours,
        hourlyRateCents: null,
        wageCents: 0,
        payType: contract.pay_type,
        note: "Festlohn — nicht tagesbasiert",
      });
      continue;
    }

    const hourlyRateCents = contract.hourly_rate_cents;
    if (hourlyRateCents == null || hourlyRateCents <= 0) {
      lines.push({
        staffId,
        workHours,
        hourlyRateCents: null,
        wageCents: 0,
        payType: "hourly",
        note: "Kein Stundenlohn hinterlegt",
      });
      continue;
    }

    const wageCents = Math.round(workHours * hourlyRateCents);
    totalCents += wageCents;
    lines.push({
      staffId,
      workHours,
      hourlyRateCents,
      wageCents,
      payType: "hourly",
      note: null,
    });
  }

  lines.sort((a, b) => b.wageCents - a.wageCents || b.workHours - a.workHours);

  return { lines, totalCents };
}

export type StaffPeriodWageSummary = {
  totalWageCents: number;
  totalNetWorkHours: number;
  /** Gesamtlohn ÷ erfasste Netto-Stunden (gewichteter Ø-Stundenlohn). */
  actualAvgHourlyWageCents: number | null;
  /** Mittelwert der Mitarbeiter-Gesamtlöhne im Zeitraum. */
  generalAvgWageCents: number | null;
  staffWithWageCount: number;
};

export function computeStaffPeriodWageSummary(params: {
  entries: readonly RestaurantStaffWorkEntryRow[];
  contracts: readonly RestaurantStaffContractRow[];
  periodStart: Date;
  periodEnd: Date;
  now?: Date;
}): StaffPeriodWageSummary {
  const now = params.now ?? new Date();
  const staffIds = new Set<string>();
  for (const e of params.entries) {
    if (e.entry_type === "work") staffIds.add(e.staff_id);
  }

  const wageByStaff = new Map<string, number>();
  let totalWageCents = 0;
  let totalNetWorkHours = 0;

  for (
    let day = startOfLocalDay(params.periodStart);
    day <= params.periodEnd;
    day = addDays(day, 1)
  ) {
    const dayYmd = localDayKey(day);
    for (const staffId of staffIds) {
      const workHours = sumStaffWorkHoursForDay(
        params.entries,
        staffId,
        dayYmd,
        now,
      );
      if (workHours <= 0) continue;

      const contract = findStaffContractForDay(
        params.contracts,
        staffId,
        dayYmd,
      );
      if (!contract || isStaffFixedPayType(contract.pay_type)) continue;

      const hourlyRateCents = contract.hourly_rate_cents;
      if (hourlyRateCents == null || hourlyRateCents <= 0) continue;

      const wageCents = Math.round(workHours * hourlyRateCents);
      totalWageCents += wageCents;
      totalNetWorkHours += workHours;
      wageByStaff.set(staffId, (wageByStaff.get(staffId) ?? 0) + wageCents);
    }
  }

  const staffWages = [...wageByStaff.values()].filter((c) => c > 0);

  return {
    totalWageCents,
    totalNetWorkHours: Math.round(totalNetWorkHours * 10) / 10,
    actualAvgHourlyWageCents:
      totalNetWorkHours > 0
        ? Math.round(totalWageCents / totalNetWorkHours)
        : null,
    generalAvgWageCents:
      staffWages.length > 0
        ? Math.round(
            staffWages.reduce((sum, cents) => sum + cents, 0) /
              staffWages.length,
          )
        : null,
    staffWithWageCount: staffWages.length,
  };
}

export function formatStaffAvgHourlyWage(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `${formatStaffEuroCents(cents)}/h`;
}
