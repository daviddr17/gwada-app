/** Max. Tage nach fehlgeschlagener Erneuerung, bis Paid-Module auf Free fallen. */
export const BILLING_PAST_DUE_GRACE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Abo war aktiv und die Erneuerung ist fehlgeschlagen — 7 Tage Karenz. */
export function isBillingDunningStatus(
  status: string | null | undefined,
): boolean {
  return status === "past_due" || status === "unpaid";
}

/** Zahlung ist aktuell in Ordnung. */
export function isBillingHealthyStatus(
  status: string | null | undefined,
): boolean {
  return status === "active" || status === "trialing";
}

/**
 * Stripe-Status in den DB-Status. Unbekannte Werte nicht als `active` tarnen
 * (`incomplete_expired` wäre sonst ein bezahltes Abo ohne Zahlung).
 */
export function mapStripeSubscriptionStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused":
    case "canceled":
      return stripeStatus;
    case "incomplete_expired":
      return "canceled";
    default:
      return stripeStatus;
  }
}

export function pastDueAccessEndsAt(
  pastDueSince: string | null | undefined,
): string | null {
  if (!pastDueSince) return null;
  const start = Date.parse(pastDueSince);
  if (!Number.isFinite(start)) return null;
  return new Date(
    start + BILLING_PAST_DUE_GRACE_DAYS * MS_PER_DAY,
  ).toISOString();
}

export function isPastDueGraceExpired(
  pastDueSince: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const endsAt = pastDueAccessEndsAt(pastDueSince);
  if (!endsAt) return false;
  return now.getTime() >= Date.parse(endsAt);
}

/**
 * Uhr für den aktuellen Unpaid-Zyklus:
 * - healthy → leeren (Zahlung durch / nie im Verzug)
 * - canceled → leeren
 * - past_due/unpaid → ersten Zeitpunkt behalten
 * - sonst (incomplete, paused, …) → vorhandenen Wert lassen, keinen neuen setzen
 *
 * `latestInvoiceOpen`: Stripe kann kurz `active` bleiben, während die Invoice
 * noch offen ist — dann die Uhr nicht löschen.
 */
export function nextPastDueSince(input: {
  existing: string | null;
  status: string;
  latestInvoiceOpen?: boolean;
  nowIso?: string;
}): string | null {
  if (isBillingHealthyStatus(input.status)) {
    if (input.latestInvoiceOpen && input.existing) return input.existing;
    return null;
  }
  if (input.status === "canceled") return null;
  if (isBillingDunningStatus(input.status)) {
    return input.existing ?? (input.nowIso ?? new Date().toISOString());
  }
  return input.existing;
}

/**
 * Paid-Plan-Features (Basic/Pro/Add-ons).
 * - Legacy/Kulanz: immer ja (Plan steht in der Zeile).
 * - Stripe active/trialing: ja.
 * - Stripe past_due/unpaid: ja bis 7 Tage nach erster Failed-Charge.
 * - incomplete / canceled: nein (nie bezahlt bzw. beendet).
 */
export function shouldGrantPaidPlanFeatures(input: {
  source: string;
  status: string;
  pastDueSince: string | null;
  now?: Date;
}): boolean {
  if (input.source !== "stripe") return true;
  if (isBillingHealthyStatus(input.status)) return true;
  if (input.status === "paused") return true;
  if (isBillingDunningStatus(input.status)) {
    return !isPastDueGraceExpired(input.pastDueSince, input.now);
  }
  return false;
}

export function isPastDueAccessLocked(input: {
  source: string;
  status: string;
  pastDueSince: string | null;
  now?: Date;
}): boolean {
  return (
    input.source === "stripe" &&
    isBillingDunningStatus(input.status) &&
    isPastDueGraceExpired(input.pastDueSince, input.now)
  );
}

export function isStripeSubscriptionInvoice(input: {
  subscriptionId: string | null;
  amountDue: number;
}): boolean {
  return Boolean(input.subscriptionId) && input.amountDue > 0;
}

/** Daily Stripe-Cancel-Fenster: 06:00–06:19 UTC (ein 10-Minuten-Cron trifft es einmal). */
export function isBillingPastDueSweepDue(now: Date = new Date()): boolean {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minutes >= 6 * 60 && minutes < 6 * 60 + 20;
}
