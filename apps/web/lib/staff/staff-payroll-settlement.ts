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

/** Status und Beträge aus Lohn − Auszahlungen (kein manueller Snapshot). */
export type DerivedPayrollSettlement = {
  status: StaffPayrollSettlementStatus;
  /** Lohn − Auszahlungen. */
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
}): DerivedPayrollSettlement {
  const wageCents = Math.max(0, Math.round(snap.wageCents));
  const payoutCents = Math.max(0, Math.round(snap.payoutCents));
  const dueCents = wageCents - payoutCents;
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
    dueCents,
    openCents,
    paidCents,
    overpaidCreditCents,
  };
}

/** @deprecated Use derivePayrollSettlement — kept for call-site migration. */
export function openWageCentsFromSnapshot(snap: {
  wageCents: number;
  payoutCents: number;
}): number {
  return derivePayrollSettlement(snap).openCents;
}

/** @deprecated Use derivePayrollSettlement. */
export function overpaidCreditCentsFromSnapshot(snap: {
  wageCents: number;
  payoutCents: number;
}): number {
  return derivePayrollSettlement(snap).overpaidCreditCents;
}

/** @deprecated Use derivePayrollSettlement. */
export function effectiveSettlementStatus(snap: {
  wageCents: number;
  payoutCents: number;
}): StaffPayrollSettlementStatus {
  return derivePayrollSettlement(snap).status;
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
