import {
  BILLING_ADDONS,
  BILLING_PLANS,
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import type { MollieAmount } from "@/lib/mollie/mollie-amount";
import {
  formatMollieAmountValue,
  parseMollieAmountValue,
} from "@/lib/mollie/mollie-amount";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidRestaurantId(id: string): boolean {
  return UUID_RE.test(id);
}

export const BILLING_MANDATE_UPDATE_EUROS = 0.01;

export type BillingPurpose =
  | "billing_first"
  | "billing_update_mandate"
  | "billing_proration";

export function isBillingPurpose(
  value: string | null | undefined,
): value is BillingPurpose {
  return (
    value === "billing_first" ||
    value === "billing_update_mandate" ||
    value === "billing_proration"
  );
}

export function parseBillingPlanFromMetadata(metadata: {
  plan_id?: string;
  interval?: string;
  include_pos?: string;
}): {
  planId: Exclude<BillingPlanId, "free">;
  interval: BillingInterval;
  includePos: boolean;
} | null {
  const planRaw = metadata.plan_id?.trim() ?? "";
  const intervalRaw = metadata.interval?.trim() ?? "";
  if (
    !isBillingPlanId(planRaw) ||
    planRaw === "free" ||
    !isBillingInterval(intervalRaw)
  ) {
    return null;
  }
  return {
    planId: planRaw,
    interval: intervalRaw,
    includePos: metadata.include_pos === "1",
  };
}

function catalogAmountEuros(
  planId: Exclude<BillingPlanId, "free">,
  interval: BillingInterval,
  includePos: boolean,
): number {
  const plan = BILLING_PLANS[planId];
  let euros =
    interval === "year"
      ? plan.price.yearlyPerMonthEur * 12
      : plan.price.monthlyEur;
  if (includePos) {
    const pos = BILLING_ADDONS.pos.price;
    euros +=
      interval === "year" ? pos.yearlyPerMonthEur * 12 : pos.monthlyEur;
  }
  return Math.round(euros * 100) / 100;
}

/** Paid first checkout must match catalog price for plan/interval/POS. */
export function paymentMatchesBillingCatalogAmount(input: {
  amount: MollieAmount;
  planId: Exclude<BillingPlanId, "free">;
  interval: BillingInterval;
  includePos: boolean;
}): boolean {
  if ((input.amount.currency || "").toUpperCase() !== "EUR") return false;
  const catalog = catalogAmountEuros(
    input.planId,
    input.interval,
    input.includePos,
  );
  const expectedValue = formatMollieAmountValue(catalog);
  const paid = parseMollieAmountValue(input.amount.value);
  return (
    input.amount.value === expectedValue &&
    Math.abs(paid - catalog) < 0.001
  );
}

export function paymentMatchesMandateUpdateAmount(amount: MollieAmount): boolean {
  if ((amount.currency || "").toUpperCase() !== "EUR") return false;
  const paid = parseMollieAmountValue(amount.value);
  return (
    amount.value === formatMollieAmountValue(BILLING_MANDATE_UPDATE_EUROS) &&
    Math.abs(paid - BILLING_MANDATE_UPDATE_EUROS) < 0.001
  );
}

export function resolveBillingRestaurantId(
  metadataRestaurantId: string | null | undefined,
): string | null {
  const id = metadataRestaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(id)) return null;
  return id;
}

/**
 * Only allow same-origin app paths back from Mollie Hosted Checkout.
 * Blocks open redirects and accidental secret-bearing absolute URLs.
 */
export function sanitizeBillingReturnUrl(
  candidate: string | null | undefined,
  origin: string,
  fallbackPath = "/dashboard/settings/billing",
): string {
  const fallback = `${origin.replace(/\/$/, "")}${fallbackPath}`;
  const raw = candidate?.trim() ?? "";
  if (!raw) return fallback;

  try {
    const base = new URL(origin);
    const url = new URL(raw, base);

    if (url.origin !== base.origin) return fallback;
    if (url.username || url.password) return fallback;
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;

    // Disallow embedding credentials/tokens in query or hash we send to Mollie.
    const lowered = `${url.pathname}?${url.search}#${url.hash}`.toLowerCase();
    if (
      /(^|[?&#_])(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|bearer|password|secret)=/.test(
        lowered,
      )
    ) {
      return fallback;
    }

    if (!url.pathname.startsWith("/dashboard")) return fallback;

    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/** Never echo Mollie/API detail strings to browser clients. */
export function publicBillingError(
  code: string | null | undefined,
  fallback: string,
): string {
  const value = (code ?? "").trim();
  if (!value) return fallback;
  // Allow our own snake_case codes only.
  if (/^[a-z][a-z0-9_]{2,64}$/.test(value) && !value.includes(" ")) {
    return value;
  }
  return fallback;
}
