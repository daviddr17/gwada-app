import type {
  RestaurantStaffContractRow,
  RestaurantStaffWorkEntryRow,
} from "@/lib/types/staff";

const OPEN_CONTRACT_END = "9999-12-31";

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
  now: Date = new Date(),
): number {
  let ms = 0;
  for (const e of entries) {
    if (e.staff_id !== staffId || e.entry_type !== "work") continue;
    const startMs = new Date(e.starts_at).getTime();
    const endMs = e.is_open ? now.getTime() : new Date(e.ends_at).getTime();
    ms += Math.max(0, endMs - startMs);
  }
  return ms / 3_600_000;
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
    const workHours = sumStaffWorkHoursForDay(params.entries, staffId, now);
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

    if (contract.pay_type === "fixed") {
      lines.push({
        staffId,
        workHours,
        hourlyRateCents: null,
        wageCents: 0,
        payType: "fixed",
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
