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
  loadRestaurantPastDueSince,
  upsertRestaurantAddonAdmin,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import {
  isBillingDunningStatus,
  mapStripeSubscriptionStatus,
  nextPastDueSince,
} from "@/lib/billing/past-due-grace";
import type { PlatformStripeConfig } from "@/lib/integrations/platform-stripe-config";
import type { BillingInterval, BillingPlanId } from "@/lib/billing/plan-catalog";

function unixToIso(sec: number | null | undefined): string | null {
  if (!sec) return null;
  return new Date(sec * 1000).toISOString();
}

function isLatestInvoiceOpen(sub: Stripe.Subscription): boolean {
  const latest = sub.latest_invoice;
  if (!latest || typeof latest === "string") return false;
  const status = "status" in latest ? latest.status : null;
  return status === "open" || status === "uncollectible";
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

function addonStatusForSubscription(status: string): string {
  if (status === "canceled" || status === "incomplete") return "canceled";
  if (isBillingDunningStatus(status)) return "past_due";
  return "active";
}

export async function syncStripeSubscriptionToDb(
  config: PlatformStripeConfig,
  sub: Stripe.Subscription,
  restaurantIdHint?: string | null,
): Promise<{ ok: true; restaurantId: string } | { ok: false; error: string }> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return { ok: false, error: "missing_customer" };

  const restaurantId =
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
  const status = mapStripeSubscriptionStatus(sub.status);
  const existingPastDueSince = await loadRestaurantPastDueSince(restaurantId);
  const pastDueSince = nextPastDueSince({
    existing: existingPastDueSince,
    status,
    latestInvoiceOpen: isLatestInvoiceOpen(sub),
  });

  const storedPlanId: BillingPlanId = status === "canceled" ? "free" : planId;

  const upsert = await upsertRestaurantSubscriptionAdmin({
    restaurantId,
    planId: storedPlanId,
    interval,
    status,
    source: "stripe",
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: planPriceId,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    pastDueSince,
  });

  if (!upsert.ok) return upsert;

  if (posItem?.price?.id) {
    const posInterval =
      intervalFromPriceId(config, posItem.price.id) ?? interval;
    await upsertRestaurantAddonAdmin({
      restaurantId,
      addonId: "pos",
      status: addonStatusForSubscription(status),
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
