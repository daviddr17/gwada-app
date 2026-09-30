import type { StaffPayrollSettlementStatus } from "@/lib/types/staff";

export const STAFF_PAYROLL_SETTLEMENT_STATUS_LABELS: Record<
  StaffPayrollSettlementStatus,
  string
> = {
  open: "Offen",
  paid: "Bezahlt",
  overpaid: "Überzahlt",
  underpaid: "Unterzahlt",
};

/** Status und Beträge aus Übertrag + Lohn − Auszahlungen (kein manueller Snapshot). */
export type DerivedPayrollSettlement = {
  status: StaffPayrollSettlementStatus;
  /** Saldo aus allen früheren Monaten. Negativ = zu viel gezahlt. */
  carryCents: number;
  /**
   * Offen, vorzeichenbehaftet:
   * Übertrag + Lohn dieses Monats − Auszahlungen dieses Monats.
   */
  dueCents: number;
  /** Noch zu zahlen: max(0, due). */
  openCents: number;
  /** Bereits auf den Lohn angerechnet: min(Lohn, Auszahlungen). */
  paidCents: number;
  /** Überzahlung: max(0, −due). */
  overpaidCreditCents: number;
};

export function derivePayrollSettlement(snap: {
  wageCents: number;
  payoutCents: number;
  /** Saldo vor diesem Monat. Weglassen = 0 (nur dieser Monat). */
  carryCents?: number;
}): DerivedPayrollSettlement {
  const wageCents = Math.max(0, Math.round(snap.wageCents));
  const payoutCents = Math.max(0, Math.round(snap.payoutCents));
  const carryCents = Math.round(snap.carryCents ?? 0);
  const dueCents = carryCents + wageCents - payoutCents;
  const openCents = Math.max(0, dueCents);
  const paidCents = Math.min(wageCents, payoutCents);
  const overpaidCreditCents = Math.max(0, -dueCents);

  let status: StaffPayrollSettlementStatus;
  if (dueCents < 0) status = "overpaid";
  else if (dueCents === 0) status = "paid";
  else if (payoutCents > 0) status = "underpaid";
  else status = "open";

  return {
    status,
    carryCents,
    dueCents,
    openCents,
    paidCents,
    overpaidCreditCents,
  };
}

export type PayrollMonthMoney = {
  staffId: string;
  periodYear: number;
  periodMonth: number;
  wageCents: number;
  payoutCents: number;
};

export type PayrollMonthWithCarry = PayrollMonthMoney & DerivedPayrollSettlement;

function payrollMonthSortKey(year: number, month: number): number {
  return year * 100 + month;
}

/**
 * Übertrag je Mitarbeiter: Schlusssaldo des Vormonats.
 * Monate chronologisch; ein negativer Saldo bleibt stehen.
 */
export function withPayrollCarryForward(
  months: readonly PayrollMonthMoney[],
): PayrollMonthWithCarry[] {
  const sorted = [...months].sort((a, b) => {
    const ym =
      payrollMonthSortKey(a.periodYear, a.periodMonth) -
      payrollMonthSortKey(b.periodYear, b.periodMonth);
    if (ym !== 0) return ym;
    return a.staffId.localeCompare(b.staffId);
  });
  const running = new Map<string, number>();
  return sorted.map((row) => {
    const carryCents = running.get(row.staffId) ?? 0;
    const derived = derivePayrollSettlement({
      wageCents: row.wageCents,
      payoutCents: row.payoutCents,
      carryCents,
    });
    running.set(row.staffId, derived.dueCents);
    return { ...row, ...derived };
  });
}

/** Saldo unmittelbar vor diesem Monat (0, wenn es keinen früheren Monat gibt). */
export function payrollCarryCentsBeforeMonth(
  settled: readonly Pick<
    PayrollMonthWithCarry,
    "staffId" | "periodYear" | "periodMonth" | "dueCents"
  >[],
  staffId: string,
  year: number,
  month: number,
): number {
  const target = payrollMonthSortKey(year, month);
  let best = -1;
  let carry = 0;
  for (const row of settled) {
    if (row.staffId !== staffId) continue;
    const key = payrollMonthSortKey(row.periodYear, row.periodMonth);
    if (key >= target || key < best) continue;
    best = key;
    carry = row.dueCents;
  }
  return carry;
}

/**
 * Auszahlung in Stunden → Cent mit demselben Stundenlohn,
 * der die gearbeiteten Stunden bewertet. Kein eigener Satz.
 */
export function payoutCentsFromHours(
  hours: number,
  hourlyRateCents: number,
): number | null {
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (!Number.isFinite(hourlyRateCents) || hourlyRateCents <= 0) return null;
  const cents = Math.round(hours * hourlyRateCents);
  return cents > 0 ? cents : null;
}

/** Soll-Stunden für Kalendermonat aus Wochen-Soll-Minuten. */
export function targetHoursForCalendarMonth(
  targetWeeklyMinutes: number | null | undefined,
  year: number,
  month1to12: number,
): number | null {
  if (targetWeeklyMinutes == null || targetWeeklyMinutes <= 0) return null;
  const daysInMonth = new Date(year, month1to12, 0).getDate();
  return (
    Math.round(((targetWeeklyMinutes / 60) * daysInMonth) / 7 * 10) / 10
  );
}

export function monthsInclusive(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  let y = fromYear;
  let m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function payrollPeriodKey(
  year: number,
  month: number,
  staffId: string,
): string {
  return `${year}-${String(month).padStart(2, "0")}:${staffId}`;
}
