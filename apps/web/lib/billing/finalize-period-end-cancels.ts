import "server-only";

import { getMollieBillingAuth } from "@/lib/billing/mollie-server";
import {
  finalizeRestaurantPeriodEndCancel,
  listMollieSubscriptionsPeriodEndCancelDue,
} from "@/lib/billing/subscription-db";
import {
  mollieCancelSubscription,
  mollieGetSubscription,
} from "@/lib/mollie/mollie-payments";

export async function finalizeMolliePeriodEndCancellations(): Promise<{
  scanned: number;
  finalized: number;
  failed: number;
}> {
  const due = await listMollieSubscriptionsPeriodEndCancelDue();
  if (due.length === 0) {
    return { scanned: 0, finalized: 0, failed: 0 };
  }

  const client = await getMollieBillingAuth();
  let finalized = 0;
  let failed = 0;

  for (const row of due) {
    try {
      if (client && row.mollieCustomerId && row.mollieSubscriptionId) {
        const current = await mollieGetSubscription(
          client.auth,
          row.mollieCustomerId,
          row.mollieSubscriptionId,
        );
        if (
          current.ok &&
          current.data.status !== "canceled" &&
          current.data.status !== "completed"
        ) {
          await mollieCancelSubscription(
            client.auth,
            row.mollieCustomerId,
            row.mollieSubscriptionId,
          );
        }
      }

      const result = await finalizeRestaurantPeriodEndCancel({
        restaurantId: row.restaurantId,
        interval: row.interval,
        mollieCustomerId: row.mollieCustomerId,
        mollieSubscriptionId: row.mollieSubscriptionId,
      });
      if (!result.ok) {
        failed += 1;
        console.warn(
          "billing period-end finalize",
          row.restaurantId,
          result.error,
        );
        continue;
      }
      finalized += 1;
    } catch (err) {
      failed += 1;
      console.warn(
        "billing period-end finalize",
        row.restaurantId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { scanned: due.length, finalized, failed };
}
