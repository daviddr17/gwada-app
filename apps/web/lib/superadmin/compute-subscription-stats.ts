import {
  catalogMonthlyEur,
  formatEurFromCents,
} from "@/lib/billing/billing-status-labels";
import {
  BILLING_PLANS,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import type {
  SuperadminBillingInvoiceRow,
  SuperadminSubscriptionRow,
} from "@/lib/supabase/platform-superadmin-db";
import {
  countByLabel,
  countByMonth,
  lastMonthKeys,
  type LabelCount,
} from "@/lib/superadmin/stats-series";

const CHART_MONTHS = 12;

function asPlanId(value: string): BillingPlanId {
  if (value === "basic" || value === "pro" || value === "free") return value;
  return "free";
}

function asInterval(value: string | null | undefined): BillingInterval {
  return value === "year" ? "year" : "month";
}

function isPayingStatus(status: string): boolean {
  return ["active", "trialing", "past_due"].includes(status);
}

function sumPaidByMonth(
  invoices: SuperadminBillingInvoiceRow[],
  monthKeys: string[],
): { label: string; cents: number }[] {
  const map = new Map(monthKeys.map((k) => [k, 0]));
  for (const inv of invoices) {
    if (inv.status !== "paid" || !inv.paid_at) continue;
    const d = new Date(inv.paid_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) continue;
    map.set(key, (map.get(key) ?? 0) + inv.amount_paid);
  }
  return monthKeys.map((key) => {
    const [y, m] = key.split("-");
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
      "de-DE",
      { month: "short", year: "2-digit" },
    );
    return { label, cents: map.get(key) ?? 0 };
  });
}

export type SuperadminSubscriptionStats = {
  kpis: {
    totalRestaurants: number;
    payingCount: number;
    legacyCount: number;
    complimentaryCount: number;
    freeCount: number;
    posCount: number;
    mrrEur: number;
    arrEur: number;
    paidLast30DaysEur: number;
    paidAllTimeEur: number;
    failedCount: number;
  };
  planDistribution: LabelCount[];
  sourceDistribution: LabelCount[];
  statusDistribution: LabelCount[];
  revenueByMonth: { label: string; eur: number }[];
  newPayingByMonth: { label: string; count: number }[];
};

export function computeSubscriptionStats(
  subscriptions: SuperadminSubscriptionRow[],
  invoices: SuperadminBillingInvoiceRow[],
): SuperadminSubscriptionStats {
  const monthKeys = lastMonthKeys(CHART_MONTHS);

  let mrrEur = 0;
  let payingCount = 0;
  let legacyCount = 0;
  let complimentaryCount = 0;
  let freeCount = 0;
  let posCount = 0;

  for (const row of subscriptions) {
    const planId = asPlanId(row.plan_id);
    if (row.source === "legacy" || row.status === "legacy") legacyCount += 1;
    if (row.source === "complimentary") complimentaryCount += 1;
    if (planId === "free" && row.source !== "legacy") freeCount += 1;
    if (row.has_pos) posCount += 1;

    const countsForMrr =
      isPayingStatus(row.status) &&
      row.source === "stripe" &&
      planId !== "free";
    if (countsForMrr) {
      payingCount += 1;
      mrrEur += catalogMonthlyEur(
        planId,
        asInterval(row.billing_interval),
        row.has_pos,
        asInterval(row.pos_interval),
      );
    }
  }

  const now = Date.now();
  const day30 = now - 30 * 24 * 60 * 60 * 1000;
  let paidLast30 = 0;
  let paidAll = 0;
  let failedCount = 0;
  for (const inv of invoices) {
    if (inv.status === "payment_failed") failedCount += 1;
    if (inv.status !== "paid") continue;
    paidAll += inv.amount_paid;
    if (inv.paid_at && new Date(inv.paid_at).getTime() >= day30) {
      paidLast30 += inv.amount_paid;
    }
  }

  const payingCreated = subscriptions
    .filter(
      (r) =>
        asPlanId(r.plan_id) !== "free" &&
        (r.source === "stripe" || r.source === "complimentary"),
    )
    .map((r) => r.created_at);

  return {
    kpis: {
      totalRestaurants: subscriptions.length,
      payingCount,
      legacyCount,
      complimentaryCount,
      freeCount,
      posCount,
      mrrEur,
      arrEur: mrrEur * 12,
      paidLast30DaysEur: paidLast30 / 100,
      paidAllTimeEur: paidAll / 100,
      failedCount,
    },
    planDistribution: [
      {
        name: BILLING_PLANS.free.name,
        count: subscriptions.filter((r) => asPlanId(r.plan_id) === "free")
          .length,
      },
      {
        name: BILLING_PLANS.basic.name,
        count: subscriptions.filter((r) => asPlanId(r.plan_id) === "basic")
          .length,
      },
      {
        name: BILLING_PLANS.pro.name,
        count: subscriptions.filter((r) => asPlanId(r.plan_id) === "pro")
          .length,
      },
    ],
    sourceDistribution: countByLabel(subscriptions, (r) => r.source || "—"),
    statusDistribution: countByLabel(subscriptions, (r) => r.status || "—"),
    revenueByMonth: sumPaidByMonth(invoices, monthKeys).map((p) => ({
      label: p.label,
      eur: p.cents / 100,
    })),
    newPayingByMonth: countByMonth(payingCreated, monthKeys).map((p) => ({
      label: p.label,
      count: p.count,
    })),
  };
}

export function formatStatsEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export { formatEurFromCents };
