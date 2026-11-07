import "server-only";

import { cancelMollieSubscriptionsPastDueGraceExpired } from "@/lib/billing/cancel-past-due-grace";
import { finalizeMolliePeriodEndCancellations } from "@/lib/billing/finalize-period-end-cancels";
import { getMollieBillingAuth } from "@/lib/billing/mollie-server";
import { syncMollieSubscriptionToDb } from "@/lib/billing/sync-mollie-subscription";
import {
  loadRestaurantPeriodEndCancelState,
  listMollieLinkedSubscriptions,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import type { BillingInterval, BillingPlanId } from "@/lib/billing/plan-catalog";
import { mollieGetSubscription } from "@/lib/mollie/mollie-payments";

async function markMollieSubscriptionMissing(input: {
  restaurantId: string;
  mollieSubscriptionId: string;
  mollieCustomerId: string | null;
  interval: string;
}): Promise<boolean> {
  const interval: BillingInterval =
    input.interval === "year" ? "year" : "month";
  const existing = await loadRestaurantPeriodEndCancelState(input.restaurantId);
  const periodEndMs = existing?.currentPeriodEnd
    ? Date.parse(existing.currentPeriodEnd)
    : NaN;
  if (
    existing?.cancelAtPeriodEnd &&
    Number.isFinite(periodEndMs) &&
    periodEndMs > Date.now()
  ) {
    // Period-end cancel already removed the Mollie sub — keep paid access.
    return true;
  }
  const result = await upsertRestaurantSubscriptionAdmin({
    restaurantId: input.restaurantId,
    planId: "free" as BillingPlanId,
    interval,
    status: "canceled",
    source: "mollie",
    mollieCustomerId: input.mollieCustomerId,
    mollieSubscriptionId: input.mollieSubscriptionId,
    cancelAtPeriodEnd: false,
    pastDueSince: null,
  });
  if (!result.ok) {
    console.warn(
      "billing health missing-sub upsert",
      input.restaurantId,
      result.error,
    );
    return false;
  }
  return true;
}

export type DailyBillingHealthStats = {
  mollieListed: number;
  dbLinked: number;
  synced: number;
  missing: number;
  failed: number;
  cutoff: {
    scanned: number;
    canceled: number;
    recovered: number;
    failed: number;
  };
  periodEnd: {
    scanned: number;
    finalized: number;
    failed: number;
  };
};

/** Einmal täglich: Mollie ↔ DB abgleichen, dann 7-Tage-Cutoff. */
export async function runDailyBillingHealthCheck(): Promise<DailyBillingHealthStats> {
  const cutoffEmpty = {
    scanned: 0,
    canceled: 0,
    recovered: 0,
    failed: 0,
  };
  const client = await getMollieBillingAuth();
  const dbRows = await listMollieLinkedSubscriptions();

  if (!client) {
    console.warn("billing health: mollie_not_configured");
    const periodEnd = await finalizeMolliePeriodEndCancellations();
    return {
      mollieListed: 0,
      dbLinked: dbRows.length,
      synced: 0,
      missing: 0,
      failed: dbRows.length,
      cutoff: cutoffEmpty,
      periodEnd,
    };
  }

  let synced = 0;
  let failed = 0;
  let missing = 0;

  for (const row of dbRows) {
    if (!row.mollieCustomerId) {
      failed += 1;
      continue;
    }
    const sub = await mollieGetSubscription(
      client.auth,
      row.mollieCustomerId,
      row.mollieSubscriptionId,
    );
    if (!sub.ok) {
      if (sub.status === 404) {
        const ok = await markMollieSubscriptionMissing(row);
        if (ok) missing += 1;
        else failed += 1;
      } else {
        failed += 1;
        console.warn(
          "billing health retrieve",
          row.restaurantId,
          sub.detail,
        );
      }
      continue;
    }
    const result = await syncMollieSubscriptionToDb(
      sub.data,
      row.restaurantId,
    );
    if (result.ok) synced += 1;
    else {
      failed += 1;
      console.warn(
        "billing health db-row sync",
        row.restaurantId,
        result.error,
      );
    }
  }

  const cutoff = await cancelMollieSubscriptionsPastDueGraceExpired();
  const periodEnd = await finalizeMolliePeriodEndCancellations();
  const stats: DailyBillingHealthStats = {
    mollieListed: dbRows.length,
    dbLinked: dbRows.length,
    synced,
    missing,
    failed,
    cutoff,
    periodEnd,
  };
  console.info("billing health", stats);
  return stats;
}
