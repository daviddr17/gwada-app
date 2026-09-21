import "server-only";

import {
  canChangeStripePlan,
  hasManagedStripeSubscription,
} from "@/lib/billing/entitlements";
import {
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import {
  createStripeClient,
  isPosPriceId,
  planPriceSlot,
  resolvePriceId,
} from "@/lib/billing/stripe-server";
import { syncStripeSubscriptionToDb } from "@/lib/billing/sync-stripe-subscription";
import { loadRestaurantEntitlements } from "@/lib/billing/subscription-db";

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
  if (!canChangeStripePlan(entitlements) || !entitlements.stripeSubscriptionId) {
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

  const client = await createStripeClient();
  if (!client) {
    return { ok: false, error: "stripe_not_configured", status: 503 };
  }

  const priceId = resolvePriceId(
    client.config,
    planPriceSlot(input.planId, input.interval),
  );
  if (!priceId) {
    return { ok: false, error: "price_not_configured", status: 503 };
  }

  const sub = await client.stripe.subscriptions.retrieve(
    entitlements.stripeSubscriptionId,
    { expand: ["items.data.price"] },
  );
  const planItem = sub.items.data.find((item) => {
    const id = item.price?.id;
    return Boolean(id) && !isPosPriceId(client.config, id);
  });
  if (!planItem?.id) {
    return { ok: false, error: "plan_item_missing", status: 500 };
  }

  if (planItem.price?.id === priceId) {
    return { ok: true };
  }

  const updated = await client.stripe.subscriptions.update(sub.id, {
    items: [{ id: planItem.id, price: priceId }],
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: {
      restaurant_id: input.restaurantId,
      plan_id: input.planId,
      interval: input.interval,
    },
    expand: ["items.data.price"],
  });

  const synced = await syncStripeSubscriptionToDb(
    client.config,
    updated,
    input.restaurantId,
  );
  if (!synced.ok) {
    return { ok: false, error: synced.error, status: 500 };
  }
  return { ok: true };
}

export async function setRestaurantBillingCancelAtPeriodEnd(input: {
  restaurantId: string;
  cancel: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const entitlements = await loadRestaurantEntitlements(input.restaurantId);
  if (!hasManagedStripeSubscription(entitlements) || !entitlements.stripeSubscriptionId) {
    return { ok: false, error: "no_managed_subscription", status: 409 };
  }

  const client = await createStripeClient();
  if (!client) {
    return { ok: false, error: "stripe_not_configured", status: 503 };
  }

  const updated = await client.stripe.subscriptions.update(
    entitlements.stripeSubscriptionId,
    { cancel_at_period_end: input.cancel },
  );
  const synced = await syncStripeSubscriptionToDb(
    client.config,
    updated,
    input.restaurantId,
  );
  if (!synced.ok) {
    return { ok: false, error: synced.error, status: 500 };
  }
  return { ok: true };
}
