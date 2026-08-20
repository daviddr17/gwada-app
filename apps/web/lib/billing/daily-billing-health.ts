import "server-only";

import type Stripe from "stripe";
import { cancelStripeSubscriptionsPastDueGraceExpired } from "@/lib/billing/cancel-past-due-grace";
import { createStripeClient } from "@/lib/billing/stripe-server";
import { syncStripeSubscriptionToDb } from "@/lib/billing/sync-stripe-subscription";
import {
  listStripeLinkedSubscriptions,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import type { BillingInterval, BillingPlanId } from "@/lib/billing/plan-catalog";

const SUB_EXPAND = ["items.data.price", "latest_invoice"] as const;
const OPEN_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
] as const;

function isStripeMissing(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "resource_missing"
  );
}

async function markStripeSubscriptionMissing(input: {
  restaurantId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string | null;
  interval: string;
}): Promise<boolean> {
  const interval: BillingInterval =
    input.interval === "year" ? "year" : "month";
  const result = await upsertRestaurantSubscriptionAdmin({
    restaurantId: input.restaurantId,
    planId: "free" as BillingPlanId,
    interval,
    status: "canceled",
    source: "stripe",
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
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

async function listOpenStripeSubscriptions(
  stripe: Stripe,
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];
  for (const status of OPEN_STATUSES) {
    let startingAfter: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const list = await stripe.subscriptions.list({
        status,
        limit: 100,
        starting_after: startingAfter,
        expand: ["data.items.data.price", "data.latest_invoice"],
      });
      out.push(...list.data);
      if (!list.has_more || list.data.length === 0) break;
      startingAfter = list.data[list.data.length - 1]?.id;
      if (!startingAfter) break;
    }
  }
  return out;
}

export type DailyBillingHealthStats = {
  stripeListed: number;
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

/** Einmal täglich: Stripe ↔ DB abgleichen, dann 7-Tage-Cutoff. */
export async function runDailyBillingHealthCheck(): Promise<DailyBillingHealthStats> {
  const cutoffEmpty = {
    scanned: 0,
    canceled: 0,
    recovered: 0,
    failed: 0,
  };
  const client = await createStripeClient();
  const dbRows = await listStripeLinkedSubscriptions();

  if (!client) {
    console.warn("billing health: stripe_not_configured");
    return {
      stripeListed: 0,
      dbLinked: dbRows.length,
      synced: 0,
      missing: 0,
      failed: dbRows.length,
      cutoff: cutoffEmpty,
    };
  }

  const seen = new Set<string>();
  let synced = 0;
  let failed = 0;
  let missing = 0;

  const listed = await listOpenStripeSubscriptions(client.stripe);
  for (const sub of listed) {
    seen.add(sub.id);
    const result = await syncStripeSubscriptionToDb(client.config, sub);
    if (result.ok) synced += 1;
    else {
      failed += 1;
      console.warn("billing health stripe-list sync", sub.id, result.error);
    }
  }

  for (const row of dbRows) {
    if (seen.has(row.stripeSubscriptionId)) continue;
    try {
      const sub = await client.stripe.subscriptions.retrieve(
        row.stripeSubscriptionId,
        { expand: [...SUB_EXPAND] },
      );
      seen.add(sub.id);
      const result = await syncStripeSubscriptionToDb(
        client.config,
        sub,
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
    } catch (err) {
      if (isStripeMissing(err)) {
        const ok = await markStripeSubscriptionMissing(row);
        if (ok) missing += 1;
        else failed += 1;
        continue;
      }
      failed += 1;
      console.warn(
        "billing health retrieve",
        row.restaurantId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const cutoff = await cancelStripeSubscriptionsPastDueGraceExpired();
  const stats: DailyBillingHealthStats = {
    stripeListed: listed.length,
    dbLinked: dbRows.length,
    synced,
    missing,
    failed,
    cutoff,
  };
  console.info("billing health", stats);
  return stats;
}
