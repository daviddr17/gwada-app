import {
  BILLING_ADDONS,
  BILLING_PLANS,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Same formula as mollie-server billingPlanAmountEuros (kept free of server-only). */
export function catalogPeriodAmountEuros(
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

export function subtractBillingInterval(
  periodEndIso: string,
  interval: BillingInterval,
): string {
  const end = new Date(periodEndIso);
  if (interval === "year") {
    end.setUTCFullYear(end.getUTCFullYear() - 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() - 1);
  }
  return end.toISOString();
}

export function computeUnusedPeriodCredit(input: {
  periodAmountEuros: number;
  periodStartIso: string;
  periodEndIso: string;
  now?: Date;
}): {
  totalMs: number;
  remainingMs: number;
  remainingFraction: number;
  creditEuros: number;
} {
  const now = input.now ?? new Date();
  const startMs = Date.parse(input.periodStartIso);
  const endMs = Date.parse(input.periodEndIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return {
      totalMs: 0,
      remainingMs: 0,
      remainingFraction: 0,
      creditEuros: 0,
    };
  }
  const totalMs = endMs - startMs;
  const remainingMs = Math.max(0, Math.min(totalMs, endMs - now.getTime()));
  const remainingFraction = remainingMs / totalMs;
  const creditEuros =
    Math.round(input.periodAmountEuros * remainingFraction * 100) / 100;
  return { totalMs, remainingMs, remainingFraction, creditEuros };
}

export type PlanChangeProration = {
  kind: "upgrade" | "downgrade" | "lateral";
  currentPeriodAmountEuros: number;
  newPeriodAmountEuros: number;
  unusedCreditEuros: number;
  /** Immediate Mollie charge before switching the subscription. */
  chargeNowEuros: number;
  remainingFraction: number;
  periodStartIso: string;
  periodEndIso: string;
};

/**
 * New plan starts immediately. Unused remainder of the current period is credited
 * toward the new period price; only a positive delta is charged now.
 */
export function computePlanChangeProration(input: {
  currentPlanId: Exclude<BillingPlanId, "free">;
  currentInterval: BillingInterval;
  newPlanId: Exclude<BillingPlanId, "free">;
  newInterval: BillingInterval;
  includePos: boolean;
  periodEndIso: string;
  periodStartIso?: string | null;
  now?: Date;
}): PlanChangeProration {
  const periodEndIso = input.periodEndIso;
  const periodStartIso =
    input.periodStartIso?.trim() ||
    subtractBillingInterval(periodEndIso, input.currentInterval);

  const currentPeriodAmountEuros = catalogPeriodAmountEuros(
    input.currentPlanId,
    input.currentInterval,
    input.includePos,
  );
  const newPeriodAmountEuros = catalogPeriodAmountEuros(
    input.newPlanId,
    input.newInterval,
    input.includePos,
  );

  const unused = computeUnusedPeriodCredit({
    periodAmountEuros: currentPeriodAmountEuros,
    periodStartIso,
    periodEndIso,
    now: input.now,
  });

  const chargeNowEuros = Math.max(
    0,
    Math.round((newPeriodAmountEuros - unused.creditEuros) * 100) / 100,
  );

  let kind: PlanChangeProration["kind"] = "lateral";
  if (newPeriodAmountEuros > currentPeriodAmountEuros + 0.009) kind = "upgrade";
  else if (newPeriodAmountEuros < currentPeriodAmountEuros - 0.009) {
    kind = "downgrade";
  }

  return {
    kind,
    currentPeriodAmountEuros,
    newPeriodAmountEuros,
    unusedCreditEuros: unused.creditEuros,
    chargeNowEuros,
    remainingFraction: unused.remainingFraction,
    periodStartIso,
    periodEndIso,
  };
}

/** Rough remaining whole days for UI copy. */
export function remainingPeriodDays(periodEndIso: string, now = new Date()): number {
  const endMs = Date.parse(periodEndIso);
  if (!Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.ceil((endMs - now.getTime()) / MS_PER_DAY));
}
