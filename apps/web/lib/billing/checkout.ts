import "server-only";

import {
  isBillingAddonPurchasable,
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { isGratisBillingSource } from "@/lib/billing/gratis-billing";
import {
  billingSubscriptionDescription,
  billingSubscriptionInterval,
  getMollieBillingAuth,
  mollieBillingAmount,
} from "@/lib/billing/mollie-server";
import { syncMollieSubscriptionToDb } from "@/lib/billing/sync-mollie-subscription";
import {
  ensureRestaurantSubscriptionRow,
  loadRestaurantEntitlements,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import { getPublicSiteUrl } from "@/lib/public-env";
import {
  mollieCancelSubscription,
  mollieCreateCustomer,
  mollieCreatePayment,
  mollieGetSubscription,
} from "@/lib/mollie/mollie-payments";
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

function billingWebhookUrl(reqOrigin?: string): string {
  const path = "/api/billing/mollie/webhook";
  const site = getPublicSiteUrl();
  if (site) return `${site}${path}`;
  if (reqOrigin) return `${reqOrigin}${path}`;
  return path;
}

export async function createBillingCheckoutSession(
  input: CheckoutRequest,
): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string; status: number }
> {
  if (input.includePos && !isBillingAddonPurchasable("pos")) {
    input = { ...input, includePos: false };
  }
  if (input.planId === "free") {
    return { ok: false, error: "free_no_checkout", status: 400 };
  }
  if (!isBillingPlanId(input.planId) || !isBillingInterval(input.interval)) {
    return { ok: false, error: "invalid_plan", status: 400 };
  }

  const client = await getMollieBillingAuth();
  if (!client) {
    return { ok: false, error: "mollie_not_configured", status: 503 };
  }
  const { auth, config } = client;

  await ensureRestaurantSubscriptionRow(input.restaurantId);
  const entitlements = await loadRestaurantEntitlements(input.restaurantId);
  if (isGratisBillingSource(entitlements.source, entitlements.status)) {
    return { ok: false, error: "manual_plan", status: 409 };
  }
  const blockingStatuses = ["active", "trialing", "past_due", "unpaid"];
  if (
    entitlements.mollieSubscriptionId &&
    entitlements.mollieCustomerId &&
    entitlements.source === "mollie" &&
    blockingStatuses.includes(entitlements.status)
  ) {
    if (!entitlements.pastDueGraceExpired) {
      return { ok: false, error: "use_plan_change", status: 409 };
    }
    const current = await mollieGetSubscription(
      auth,
      entitlements.mollieCustomerId,
      entitlements.mollieSubscriptionId,
    );
    if (current.ok && current.data.status !== "canceled") {
      const canceled = await mollieCancelSubscription(
        auth,
        entitlements.mollieCustomerId,
        entitlements.mollieSubscriptionId,
      );
      if (canceled.ok) {
        await syncMollieSubscriptionToDb(canceled.data, input.restaurantId);
      }
    }
  }

  const admin = createSupabaseAdminClient();
  const { data: restaurant } = admin
    ? await admin
        .from("restaurants")
        .select("name")
        .eq("id", input.restaurantId)
        .maybeSingle()
    : { data: null };

  const restaurantName =
    typeof restaurant?.name === "string" ? restaurant.name : null;

  let customerId = entitlements.mollieCustomerId;
  if (!customerId) {
    const customer = await mollieCreateCustomer(auth, {
      name: restaurantName || "Gwada Restaurant",
      email: input.customerEmail,
      metadata: { restaurant_id: input.restaurantId },
    });
    if (!customer.ok) {
      return {
        ok: false,
        error: customer.detail || "customer_create_failed",
        status: 502,
      };
    }
    customerId = customer.data.id;
    await upsertRestaurantSubscriptionAdmin({
      restaurantId: input.restaurantId,
      planId: entitlements.planId,
      interval: entitlements.interval,
      status: entitlements.status,
      source:
        entitlements.source === "mollie" ||
        entitlements.source === "manual" ||
        entitlements.source === "legacy" ||
        entitlements.source === "complimentary"
          ? entitlements.source
          : "manual",
      mollieCustomerId: customerId,
      mollieSubscriptionId: entitlements.mollieSubscriptionId,
    });
  }

  const amount = mollieBillingAmount(
    input.planId,
    input.interval,
    Boolean(input.includePos),
  );
  const description = billingSubscriptionDescription({
    planId: input.planId,
    interval: input.interval,
    includePos: Boolean(input.includePos),
    restaurantName,
  });

  const payment = await mollieCreatePayment(auth, {
    amount,
    customerId,
    sequenceType: "first",
    description,
    redirectUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    webhookUrl: billingWebhookUrl(),
    ...(config.profile_id ? { profileId: config.profile_id } : {}),
    metadata: {
      restaurant_id: input.restaurantId,
      plan_id: input.planId,
      interval: input.interval,
      include_pos: input.includePos ? "1" : "0",
      purpose: "billing_first",
      restaurant_name: restaurantName ?? "",
    },
  });

  if (!payment.ok) {
    return {
      ok: false,
      error: payment.detail || "payment_create_failed",
      status: 502,
    };
  }

  const checkoutUrl = payment.data._links?.checkout?.href;
  if (!checkoutUrl) {
    return { ok: false, error: "checkout_url_missing", status: 500 };
  }

  await upsertRestaurantSubscriptionAdmin({
    restaurantId: input.restaurantId,
    planId: input.planId,
    interval: input.interval,
    status: "incomplete",
    source: "mollie",
    mollieCustomerId: customerId,
  });

  return { ok: true, url: checkoutUrl };
}

/**
 * Mollie has no Stripe Customer Portal. In-app cancel / plan change only.
 */
export async function createBillingPortalSession(_input: {
  restaurantId: string;
  returnUrl: string;
}): Promise<
  | { ok: true; url: string }
  | { ok: false; error: string; status: number }
> {
  return { ok: false, error: "mollie_no_portal", status: 501 };
}

export { billingSubscriptionInterval };
