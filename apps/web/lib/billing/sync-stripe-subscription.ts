import "server-only";

import type Stripe from "stripe";
import {
  intervalFromPriceId,
  isPosPriceId,
  planIdFromPriceId,
} from "@/lib/billing/stripe-server";
import {
  clearRestaurantAddonAdmin,
  findRestaurantIdByStripeCustomer,
  findRestaurantIdByStripeSubscription,
  upsertRestaurantAddonAdmin,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import type { PlatformStripeConfig } from "@/lib/integrations/platform-stripe-config";
import type { BillingInterval, BillingPlanId } from "@/lib/billing/plan-catalog";

function unixToIso(sec: number | null | undefined): string | null {
  if (!sec) return null;
  return new Date(sec * 1000).toISOString();
}

function subscriptionPeriod(sub: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const item = sub.items.data[0];
  const start =
    item && "current_period_start" in item
      ? (item.current_period_start as number)
      : "current_period_start" in sub
        ? (sub as { current_period_start?: number }).current_period_start
        : undefined;
  const end =
    item && "current_period_end" in item
      ? (item.current_period_end as number)
      : "current_period_end" in sub
        ? (sub as { current_period_end?: number }).current_period_end
        : undefined;
  return { start: unixToIso(start), end: unixToIso(end) };
}

export async function syncStripeSubscriptionToDb(
  config: PlatformStripeConfig,
  sub: Stripe.Subscription,
  restaurantIdHint?: string | null,
): Promise<{ ok: true; restaurantId: string } | { ok: false; error: string }> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return { ok: false, error: "missing_customer" };

  let restaurantId =
    restaurantIdHint ??
    (typeof sub.metadata?.restaurant_id === "string"
      ? sub.metadata.restaurant_id
      : null) ??
    (await findRestaurantIdByStripeSubscription(sub.id)) ??
    (await findRestaurantIdByStripeCustomer(customerId));

  if (!restaurantId) {
    return { ok: false, error: "restaurant_not_found" };
  }

  const items = sub.items.data;
  let planId: BillingPlanId = "free";
  let interval: BillingInterval = "month";
  let planPriceId: string | null = null;
  let posItem: Stripe.SubscriptionItem | null = null;

  for (const item of items) {
    const priceId = item.price?.id;
    if (!priceId) continue;
    if (isPosPriceId(config, priceId)) {
      posItem = item;
      continue;
    }
    const mapped = planIdFromPriceId(config, priceId);
    if (mapped) {
      planId = mapped;
      planPriceId = priceId;
      interval = intervalFromPriceId(config, priceId) ?? "month";
    }
  }

  const period = subscriptionPeriod(sub);
  const status =
    sub.status === "canceled" && planId !== "free"
      ? "canceled"
      : sub.status === "active" ||
          sub.status === "trialing" ||
          sub.status === "past_due" ||
          sub.status === "incomplete" ||
          sub.status === "unpaid"
        ? sub.status
        : sub.status === "canceled"
          ? "canceled"
          : "active";

  const effectivePlan: BillingPlanId =
    status === "canceled" || status === "unpaid" || status === "incomplete"
      ? status === "canceled"
        ? "free"
        : planId
      : planId;

  const upsert = await upsertRestaurantSubscriptionAdmin({
    restaurantId,
    planId: effectivePlan === "free" && status !== "canceled" ? planId : effectivePlan,
    interval,
    status: status === "canceled" ? "canceled" : status,
    source: "stripe",
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: planPriceId,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  });

  if (!upsert.ok) return upsert;

  // If canceled, drop to free explicitly
  if (status === "canceled") {
    await upsertRestaurantSubscriptionAdmin({
      restaurantId,
      planId: "free",
      interval,
      status: "canceled",
      source: "stripe",
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: planPriceId,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: false,
    });
  }

  if (posItem?.price?.id) {
    const posInterval = intervalFromPriceId(config, posItem.price.id) ?? interval;
    await upsertRestaurantAddonAdmin({
      restaurantId,
      addonId: "pos",
      status:
        status === "canceled"
          ? "canceled"
          : status === "past_due"
            ? "past_due"
            : "active",
      interval: posInterval,
      stripeSubscriptionItemId: posItem.id,
      stripePriceId: posItem.price.id,
      currentPeriodEnd: period.end,
    });
  } else if (status === "canceled") {
    await clearRestaurantAddonAdmin(restaurantId, "pos");
  }

  return { ok: true, restaurantId };
}
