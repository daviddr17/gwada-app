import type {
  RestaurantStaffPayrollSettlementRow,
  StaffPayrollSettlementStatus,
} from "@/lib/types/staff";

export const STAFF_PAYROLL_SETTLEMENT_STATUS_LABELS: Record<
  StaffPayrollSettlementStatus,
  string
> = {
  open: "Offen",
  paid: "Bezahlt",
  overpaid: "Überzahlt",
  underpaid: "Unterzahlt",
};

export type StaffMonthPayrollSnapshot = {
  staffId: string;
  periodYear: number;
  periodMonth: number;
  wageCents: number;
  advanceCents: number;
  /** Lohn − Vorschüsse. */
  dueCents: number;
  netWorkH: number;
  targetH: number | null;
  /** Ist − Soll. */
  hoursBalanceH: number | null;
  settlement: RestaurantStaffPayrollSettlementRow | null;
};

export function openWageCentsFromSnapshot(snap: {
  dueCents: number;
  settlement: RestaurantStaffPayrollSettlementRow | null;
}): number {
  const s = snap.settlement;
  if (!s || s.status === "open") return Math.max(0, snap.dueCents);
  if (s.status === "paid") return 0;
  if (s.status === "underpaid") return Math.max(0, s.amount_cents);
  return 0;
}

export function overpaidCreditCentsFromSnapshot(snap: {
  settlement: RestaurantStaffPayrollSettlementRow | null;
}): number {
  const s = snap.settlement;
  if (s?.status === "overpaid") return Math.max(0, s.amount_cents);
  return 0;
}

export function effectiveSettlementStatus(snap: {
  settlement: RestaurantStaffPayrollSettlementRow | null;
}): StaffPayrollSettlementStatus {
  return snap.settlement?.status ?? "open";
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
