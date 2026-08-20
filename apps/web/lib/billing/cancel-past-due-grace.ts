import "server-only";

import { createStripeClient } from "@/lib/billing/stripe-server";
import { syncStripeSubscriptionToDb } from "@/lib/billing/sync-stripe-subscription";
import { listStripeSubscriptionsPastDueGraceExpired } from "@/lib/billing/subscription-db";

export async function cancelStripeSubscriptionsPastDueGraceExpired(): Promise<{
  scanned: number;
  canceled: number;
  recovered: number;
  failed: number;
}> {
  const due = await listStripeSubscriptionsPastDueGraceExpired();
  if (due.length === 0) {
    return { scanned: 0, canceled: 0, recovered: 0, failed: 0 };
  }

  const client = await createStripeClient();
  if (!client) {
    return { scanned: due.length, canceled: 0, recovered: 0, failed: due.length };
  }

  let canceled = 0;
  let recovered = 0;
  let failed = 0;
  for (const row of due) {
    try {
      const current = await client.stripe.subscriptions.retrieve(
        row.stripeSubscriptionId,
        { expand: ["items.data.price", "latest_invoice"] },
      );
      if (current.status === "active" || current.status === "trialing") {
        const synced = await syncStripeSubscriptionToDb(
          client.config,
          current,
          row.restaurantId,
        );
        if (!synced.ok) {
          failed += 1;
          console.warn(
            "billing past-due recover sync",
            row.restaurantId,
            synced.error,
          );
        } else {
          recovered += 1;
        }
        continue;
      }
      if (current.status === "canceled") {
        const synced = await syncStripeSubscriptionToDb(
          client.config,
          current,
          row.restaurantId,
        );
        if (synced.ok) canceled += 1;
        else failed += 1;
        continue;
      }
      const sub = await client.stripe.subscriptions.cancel(
        row.stripeSubscriptionId,
      );
      const synced = await syncStripeSubscriptionToDb(
        client.config,
        sub,
        row.restaurantId,
      );
      if (!synced.ok) {
        failed += 1;
        console.warn(
          "billing past-due cancel sync",
          row.restaurantId,
          synced.error,
        );
        continue;
      }
      canceled += 1;
    } catch (err) {
      failed += 1;
      console.warn(
        "billing past-due cancel",
        row.restaurantId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { scanned: due.length, canceled, recovered, failed };
}
