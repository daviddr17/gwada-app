import {
  BILLING_ADDONS,
  BILLING_PLANS,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";

export function billingPlanLabel(planId: string | null | undefined): string {
  if (planId && planId in BILLING_PLANS) {
    return BILLING_PLANS[planId as BillingPlanId].name;
  }
  return planId?.trim() || "—";
}

export function billingIntervalLabel(
  interval: string | null | undefined,
): string {
  if (interval === "year") return "Jährlich";
  if (interval === "month") return "Monatlich";
  return interval?.trim() || "—";
}

export function billingStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "active":
      return "Aktiv";
    case "trialing":
      return "Testphase";
    case "past_due":
      return "Zahlungsverzug";
    case "canceled":
      return "Gekündigt";
    case "incomplete":
      return "Unvollständig";
    case "unpaid":
      return "Unbezahlt";
    case "legacy":
      return "Legacy";
    case "payment_failed":
      return "Zahlung fehlgeschlagen";
    case "paid":
      return "Bezahlt";
    case "open":
      return "Offen";
    case "draft":
      return "Entwurf";
    case "void":
      return "Storniert";
    case "uncollectible":
      return "Uneinbringlich";
    default:
      return status?.trim() || "—";
  }
}

export function billingSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "stripe":
      return "Stripe";
    case "manual":
      return "Manuell";
    case "legacy":
      return "Legacy";
    case "complimentary":
      return "Complimentary";
    default:
      return source?.trim() || "—";
  }
}

export function formatEurFromCents(cents: number, currency = "eur"): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Katalog-MRR für ein Abo (ohne Stripe-Proration). */
export function catalogMonthlyEur(
  planId: BillingPlanId,
  interval: BillingInterval,
  hasPos: boolean,
  posInterval?: BillingInterval | null,
): number {
  const plan = BILLING_PLANS[planId];
  let total =
    interval === "year" ? plan.price.yearlyPerMonthEur : plan.price.monthlyEur;
  if (hasPos) {
    const pos = BILLING_ADDONS.pos;
    const pi = posInterval ?? interval;
    total +=
      pi === "year" ? pos.price.yearlyPerMonthEur : pos.price.monthlyEur;
  }
  return total;
}
