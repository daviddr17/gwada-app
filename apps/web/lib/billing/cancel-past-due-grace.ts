import "server-only";

import { getMollieBillingAuth } from "@/lib/billing/mollie-server";
import { syncMollieSubscriptionToDb } from "@/lib/billing/sync-mollie-subscription";
import { listMollieSubscriptionsPastDueGraceExpired } from "@/lib/billing/subscription-db";
import {
  mollieCancelSubscription,
  mollieGetSubscription,
} from "@/lib/mollie/mollie-payments";

export async function cancelMollieSubscriptionsPastDueGraceExpired(): Promise<{
  scanned: number;
  canceled: number;
  recovered: number;
  failed: number;
}> {
  const due = await listMollieSubscriptionsPastDueGraceExpired();
  if (due.length === 0) {
    return { scanned: 0, canceled: 0, recovered: 0, failed: 0 };
  }

  const client = await getMollieBillingAuth();
  if (!client) {
    return { scanned: due.length, canceled: 0, recovered: 0, failed: due.length };
  }

  let canceled = 0;
  let recovered = 0;
  let failed = 0;
  for (const row of due) {
    if (!row.mollieCustomerId) {
      failed += 1;
      continue;
    }
    try {
      const current = await mollieGetSubscription(
        client.auth,
        row.mollieCustomerId,
        row.mollieSubscriptionId,
      );
      if (!current.ok) {
        failed += 1;
        continue;
      }
      if (current.data.status === "active") {
        const synced = await syncMollieSubscriptionToDb(
          current.data,
          row.restaurantId,
        );
        if (!synced.ok) failed += 1;
        else recovered += 1;
        continue;
      }
      if (current.data.status === "canceled") {
        const synced = await syncMollieSubscriptionToDb(
          current.data,
          row.restaurantId,
        );
        if (synced.ok) canceled += 1;
        else failed += 1;
        continue;
      }
      const sub = await mollieCancelSubscription(
        client.auth,
        row.mollieCustomerId,
        row.mollieSubscriptionId,
      );
      if (!sub.ok) {
        failed += 1;
        continue;
      }
      const synced = await syncMollieSubscriptionToDb(sub.data, row.restaurantId);
      if (!synced.ok) failed += 1;
      else canceled += 1;
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

/** @deprecated */
export const cancelStripeSubscriptionsPastDueGraceExpired =
  cancelMollieSubscriptionsPastDueGraceExpired;
