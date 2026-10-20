import "server-only";

import {
  canChangeMolliePlan,
  hasManagedMollieSubscription,
} from "@/lib/billing/entitlements";
import {
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import {
  billingSubscriptionDescription,
  billingSubscriptionInterval,
  getMollieBillingAuth,
  mollieBillingAmount,
} from "@/lib/billing/mollie-server";
import { syncMollieSubscriptionToDb } from "@/lib/billing/sync-mollie-subscription";
import { loadRestaurantEntitlements } from "@/lib/billing/subscription-db";
import {
  mollieCancelSubscription,
  mollieUpdateSubscription,
} from "@/lib/mollie/mollie-payments";

export async function updateRestaurantBillingPlan(input: {
  restaurantId: string;
  planId: Exclude<BillingPlanId, "free">;
  interval: BillingInterval;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!isBillingPlanId(input.planId)) {
    return { ok: false, error: "invalid_plan", status: 400 };
  }
  if (!isBillingInterval(input.interval)) {
    return { ok: false, error: "invalid_plan", status: 400 };
  }

  const entitlements = await loadRestaurantEntitlements(input.restaurantId);
  if (
    !canChangeMolliePlan(entitlements) ||
    !entitlements.mollieSubscriptionId ||
    !entitlements.mollieCustomerId
  ) {
    return {
      ok: false,
      error:
        entitlements.pastDueGraceExpired ||
        entitlements.status === "past_due" ||
        entitlements.status === "unpaid"
          ? "payment_required"
          : "no_managed_subscription",
      status: 409,
    };
  }

  const client = await getMollieBillingAuth();
  if (!client) {
    return { ok: false, error: "mollie_not_configured", status: 503 };
  }

  const includePos = entitlements.addons.includes("pos");
  const amount = mollieBillingAmount(input.planId, input.interval, includePos);
  const description = billingSubscriptionDescription({
    planId: input.planId,
    interval: input.interval,
    includePos,
  });

  const updated = await mollieUpdateSubscription(
    client.auth,
    entitlements.mollieCustomerId,
    entitlements.mollieSubscriptionId,
    {
      amount,
      interval: billingSubscriptionInterval(input.interval),
      description,
      metadata: {
        restaurant_id: input.restaurantId,
        plan_id: input.planId,
        interval: input.interval,
        include_pos: includePos ? "1" : "0",
      },
    },
  );

  if (!updated.ok) {
    return {
      ok: false,
      error: updated.detail || "plan_update_failed",
      status: 502,
    };
  }

  const synced = await syncMollieSubscriptionToDb(
    updated.data,
    input.restaurantId,
  );
  if (!synced.ok) {
    return { ok: false, error: synced.error, status: 500 };
  }
  return { ok: true };
}

export async function cancelRestaurantBillingSubscription(input: {
  restaurantId: string;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const entitlements = await loadRestaurantEntitlements(input.restaurantId);
  if (
    !hasManagedMollieSubscription(entitlements) ||
    !entitlements.mollieSubscriptionId ||
    !entitlements.mollieCustomerId
  ) {
    return { ok: false, error: "no_managed_subscription", status: 409 };
  }

  const client = await getMollieBillingAuth();
  if (!client) {
    return { ok: false, error: "mollie_not_configured", status: 503 };
  }

  const canceled = await mollieCancelSubscription(
    client.auth,
    entitlements.mollieCustomerId,
    entitlements.mollieSubscriptionId,
  );
  if (!canceled.ok) {
    return {
      ok: false,
      error: canceled.detail || "cancel_failed",
      status: 502,
    };
  }

  const synced = await syncMollieSubscriptionToDb(
    canceled.data,
    input.restaurantId,
  );
  if (!synced.ok) {
    return { ok: false, error: synced.error, status: 500 };
  }
  return { ok: true };
}

/**
 * Mollie has no Stripe-style cancel_at_period_end.
 * cancel=true → Subscription sofort bei Mollie beenden.
 * cancel=false → nicht unterstützt (kein Undo nach Cancel).
 */
export async function setRestaurantBillingCancelAtPeriodEnd(input: {
  restaurantId: string;
  cancel: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!input.cancel) {
    return { ok: false, error: "mollie_cancel_undo_unsupported", status: 400 };
  }
  return cancelRestaurantBillingSubscription({
    restaurantId: input.restaurantId,
  });
}
