import "server-only";

import { cancelMollieSubscriptionsPastDueGraceExpired } from "@/lib/billing/cancel-past-due-grace";
import { getMollieBillingAuth } from "@/lib/billing/mollie-server";
import { syncMollieSubscriptionToDb } from "@/lib/billing/sync-mollie-subscription";
import {
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
    return {
      mollieListed: 0,
      dbLinked: dbRows.length,
      synced: 0,
      missing: 0,
      failed: dbRows.length,
      cutoff: cutoffEmpty,
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
  const stats: DailyBillingHealthStats = {
    mollieListed: dbRows.length,
    dbLinked: dbRows.length,
    synced,
    missing,
    failed,
    cutoff,
  };
  console.info("billing health", stats);
  return stats;
}
