import type {
  RestaurantStaffContractRow,
  StaffContractPayType,
} from "@/lib/types/staff";
import { STAFF_CONTRACT_PAY_LABELS } from "@/lib/types/staff";

export function isStaffFixedPayType(payType: StaffContractPayType): boolean {
  return payType === "fixed" || payType === "fixed_weekly";
}

function formatEuroCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatStaffContractPaySummary(
  c: Pick<
    RestaurantStaffContractRow,
    "pay_type" | "hourly_rate_cents" | "fixed_salary_cents"
  >,
): string {
  if (c.pay_type === "hourly") {
    return `${STAFF_CONTRACT_PAY_LABELS.hourly}: ${formatEuroCents(c.hourly_rate_cents)}`;
  }
  return `${STAFF_CONTRACT_PAY_LABELS[c.pay_type]}: ${formatEuroCents(c.fixed_salary_cents)}`;
}

export function staffFixedPayInputLabel(payType: StaffContractPayType): string {
  return payType === "fixed_weekly"
    ? "Festlohn pro Woche (€)"
    : "Festlohn pro Monat (€)";
}

export function staffFixedPayValidationError(
  payType: StaffContractPayType,
): string {
  return payType === "fixed_weekly"
    ? "Bitte einen gültigen Wochen-Festlohn größer als 0 angeben."
    : "Bitte einen gültigen Festlohn größer als 0 angeben.";
}
