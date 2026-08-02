import "server-only";

import {
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import {
  createStripeClient,
  planPriceSlot,
  posPriceSlot,
  resolvePriceId,
} from "@/lib/billing/stripe-server";
import {
  ensureRestaurantSubscriptionRow,
  loadRestaurantEntitlements,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CheckoutRequest = {
  restaurantId: string;
  planId: BillingPlanId;
  interval: BillingInterval;
  includePos?: boolean;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
};

export async function createBillingCheckoutSession(
  input: CheckoutRequest,
): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string; status: number }
> {
  if (input.planId === "free") {
    return { ok: false, error: "free_no_checkout", status: 400 };
  }
  if (!isBillingPlanId(input.planId) || !isBillingInterval(input.interval)) {
    return { ok: false, error: "invalid_plan", status: 400 };
  }

  const client = await createStripeClient();
  if (!client) {
    return { ok: false, error: "stripe_not_configured", status: 503 };
  }
  const { stripe, config } = client;

  const planSlot = planPriceSlot(input.planId, input.interval);
  const planPriceId = resolvePriceId(config, planSlot);
  if (!planPriceId) {
    return { ok: false, error: "price_not_configured", status: 503 };
  }

  const lineItems: { price: string; quantity: number }[] = [
    { price: planPriceId, quantity: 1 },
  ];

  if (input.includePos) {
    const posPriceId = resolvePriceId(config, posPriceSlot(input.interval));
    if (!posPriceId) {
      return { ok: false, error: "pos_price_not_configured", status: 503 };
    }
    lineItems.push({ price: posPriceId, quantity: 1 });
  }

  await ensureRestaurantSubscriptionRow(input.restaurantId);
  const entitlements = await loadRestaurantEntitlements(input.restaurantId);

  let customerId = entitlements.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: input.customerEmail ?? undefined,
      metadata: { restaurant_id: input.restaurantId },
    });
    customerId = customer.id;
    await upsertRestaurantSubscriptionAdmin({
      restaurantId: input.restaurantId,
      planId: entitlements.planId,
      interval: entitlements.interval,
      status: entitlements.status,
      source:
        entitlements.source === "stripe" ||
        entitlements.source === "manual" ||
        entitlements.source === "legacy" ||
        entitlements.source === "complimentary"
          ? entitlements.source
          : "manual",
      stripeCustomerId: customerId,
      stripeSubscriptionId: entitlements.stripeSubscriptionId,
      cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
      currentPeriodEnd: entitlements.currentPeriodEnd,
    });
  }

  const admin = createSupabaseAdminClient();
  const { data: restaurant } = admin
    ? await admin
        .from("restaurants")
        .select("name")
        .eq("id", input.restaurantId)
        .maybeSingle()
    : { data: null };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.restaurantId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    line_items: lineItems,
    subscription_data: {
      metadata: {
        restaurant_id: input.restaurantId,
        plan_id: input.planId,
        interval: input.interval,
        include_pos: input.includePos ? "1" : "0",
      },
    },
    metadata: {
      restaurant_id: input.restaurantId,
      plan_id: input.planId,
      interval: input.interval,
      include_pos: input.includePos ? "1" : "0",
      restaurant_name:
        typeof restaurant?.name === "string" ? restaurant.name : "",
    },
  });

  if (!session.url) {
    return { ok: false, error: "checkout_url_missing", status: 500 };
  }
  return { ok: true, url: session.url };
}

export async function createBillingPortalSession(input: {
  restaurantId: string;
  returnUrl: string;
}): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string; status: number }
> {
  const client = await createStripeClient();
  if (!client) {
    return { ok: false, error: "stripe_not_configured", status: 503 };
  }
  const entitlements = await loadRestaurantEntitlements(input.restaurantId);
  if (!entitlements.stripeCustomerId) {
    return { ok: false, error: "no_customer", status: 400 };
  }

  const session = await client.stripe.billingPortal.sessions.create({
    customer: entitlements.stripeCustomerId,
    return_url: input.returnUrl,
  });
  return { ok: true, url: session.url };
}
