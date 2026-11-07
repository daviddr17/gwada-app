import "server-only";

import {
  billingSubscriptionDescription,
  billingSubscriptionInterval,
  getMollieBillingAuth,
  mollieBillingAmount,
} from "@/lib/billing/mollie-server";
import { syncMolliePaymentInvoiceToDb } from "@/lib/billing/sync-mollie-invoice";
import { syncMollieSubscriptionToDb } from "@/lib/billing/sync-mollie-subscription";
import {
  claimBillingFirstSubscriptionCreate,
  findRestaurantIdByMollieCustomer,
  isRealMollieSubscriptionId,
  loadRestaurantEntitlements,
  loadRestaurantPeriodEndCancelState,
  releaseBillingFirstSubscriptionClaim,
  stampRestaurantPastDueSince,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import {
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import {
  mollieCreateSubscription,
  mollieGetPayment,
  mollieGetSubscription,
  mollieListCustomerSubscriptions,
  mollieUpdateSubscription,
  type MollieSubscription,
} from "@/lib/mollie/mollie-payments";
import { getPublicSiteUrl } from "@/lib/public-env";

function addIntervalDate(interval: BillingInterval, from = new Date()): string {
  const d = new Date(from);
  if (interval === "year") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function findExistingBillingSubscription(
  subscriptions: MollieSubscription[],
  restaurantId: string,
): MollieSubscription | null {
  const open = subscriptions.filter(
    (s) => s.status === "active" || s.status === "pending" || s.status === "suspended",
  );
  const forRestaurant = open.find(
    (s) => s.metadata?.restaurant_id === restaurantId,
  );
  return forRestaurant ?? open[0] ?? null;
}

async function activateExistingMollieSubscription(input: {
  sub: MollieSubscription;
  restaurantId: string;
  customerId: string;
  mandateId?: string | null;
  planId: Exclude<BillingPlanId, "free">;
  interval: BillingInterval;
  includePos: boolean;
}): Promise<void> {
  await syncMollieSubscriptionToDb(
    {
      ...input.sub,
      status:
        input.sub.status === "pending" || input.sub.status === "active"
          ? "active"
          : input.sub.status,
      customerId: input.customerId,
      mandateId: input.mandateId ?? input.sub.mandateId,
      metadata: {
        restaurant_id: input.restaurantId,
        plan_id: input.planId,
        interval: input.interval,
        include_pos: input.includePos ? "1" : "0",
        ...(input.sub.metadata ?? {}),
      },
    },
    input.restaurantId,
    { clearPastDue: true },
  );
}

export async function processMollieBillingPaymentId(
  paymentId: string,
): Promise<{ processed: boolean; reason?: string }> {
  const client = await getMollieBillingAuth();
  if (!client) return { processed: false, reason: "mollie_not_configured" };

  const paymentRes = await mollieGetPayment(client.auth, paymentId);
  if (!paymentRes.ok) {
    return { processed: false, reason: "payment_fetch_failed" };
  }
  const payment = paymentRes.data;
  const metadata = payment.metadata ?? {};
  const restaurantId =
    metadata.restaurant_id ||
    (payment.customerId
      ? await findRestaurantIdByMollieCustomer(payment.customerId)
      : null);

  if (!restaurantId) {
    return { processed: true, reason: "unknown_restaurant" };
  }

  // First checkout payment → create Mollie subscription starting next period
  if (
    metadata.purpose === "billing_first" &&
    payment.status === "paid" &&
    payment.customerId
  ) {
    const planRaw = metadata.plan_id ?? "basic";
    const planId: Exclude<BillingPlanId, "free"> =
      isBillingPlanId(planRaw) && planRaw !== "free" ? planRaw : "basic";
    const intervalRaw = metadata.interval ?? "month";
    const interval: BillingInterval = isBillingInterval(intervalRaw)
      ? intervalRaw
      : "month";
    const includePos = metadata.include_pos === "1";

    const existingState = await loadRestaurantPeriodEndCancelState(restaurantId);
    if (
      isRealMollieSubscriptionId(existingState?.mollieSubscriptionId) &&
      existingState &&
      existingState.status !== "canceled" &&
      existingState.planId !== "free"
    ) {
      const existingSub = await mollieGetSubscription(
        client.auth,
        payment.customerId,
        existingState.mollieSubscriptionId!,
      );
      if (
        existingSub.ok &&
        (existingSub.data.status === "active" ||
          existingSub.data.status === "pending" ||
          existingSub.data.status === "suspended")
      ) {
        await activateExistingMollieSubscription({
          sub: existingSub.data,
          restaurantId,
          customerId: payment.customerId,
          mandateId: payment.mandateId,
          planId,
          interval,
          includePos,
        });
        await syncMolliePaymentInvoiceToDb(payment, restaurantId);
        return { processed: true, reason: "already_subscribed" };
      }
      // Canceled/completed on Mollie → fall through and create a new subscription.
    }

    const listed = await mollieListCustomerSubscriptions(
      client.auth,
      payment.customerId,
    );
    if (listed.ok) {
      const existing = findExistingBillingSubscription(
        listed.data._embedded?.subscriptions ?? [],
        restaurantId,
      );
      if (existing) {
        await activateExistingMollieSubscription({
          sub: existing,
          restaurantId,
          customerId: payment.customerId,
          mandateId: payment.mandateId,
          planId,
          interval,
          includePos,
        });
        await syncMolliePaymentInvoiceToDb(payment, restaurantId);
        return { processed: true, reason: "reused_existing_subscription" };
      }
    }

    const claim = await claimBillingFirstSubscriptionCreate(
      restaurantId,
      payment.id,
    );
    if (claim === "already_subscribed") {
      await syncMolliePaymentInvoiceToDb(payment, restaurantId);
      return { processed: true, reason: "already_subscribed" };
    }
    if (claim === "lost_race") {
      await syncMolliePaymentInvoiceToDb(payment, restaurantId);
      return { processed: true, reason: "create_claimed_elsewhere" };
    }

    const amount = mollieBillingAmount(planId, interval, includePos);
    const description = billingSubscriptionDescription({
      planId,
      interval,
      includePos,
      restaurantName: metadata.restaurant_name,
    });

    const created = await mollieCreateSubscription(
      client.auth,
      payment.customerId,
      {
        amount,
        interval: billingSubscriptionInterval(interval),
        description,
        webhookUrl: `${getPublicSiteUrl() || "https://gwada.app"}/api/billing/mollie/webhook`,
        startDate: addIntervalDate(interval),
        metadata: {
          restaurant_id: restaurantId,
          plan_id: planId,
          interval,
          include_pos: includePos ? "1" : "0",
        },
      },
    );

    if (created.ok) {
      await syncMollieSubscriptionToDb(
        {
          ...created.data,
          status: "active",
          customerId: payment.customerId,
          mandateId: payment.mandateId ?? created.data.mandateId,
          metadata: {
            restaurant_id: restaurantId,
            plan_id: planId,
            interval,
            include_pos: includePos ? "1" : "0",
          },
        },
        restaurantId,
        { clearPastDue: true },
      );
    } else {
      console.warn("billing_first subscription create", created.detail);
      await releaseBillingFirstSubscriptionClaim(restaurantId, payment.id);
    }

    await syncMolliePaymentInvoiceToDb(payment, restaurantId);
    return { processed: true };
  }

  // New mandate from payment-method update → attach to active subscription.
  if (
    metadata.purpose === "billing_update_mandate" &&
    payment.status === "paid" &&
    payment.customerId &&
    payment.mandateId
  ) {
    const entitlements = await loadRestaurantEntitlements(restaurantId);
    if (
      entitlements.mollieSubscriptionId &&
      entitlements.mollieCustomerId &&
      entitlements.source === "mollie" &&
      !entitlements.cancelAtPeriodEnd
    ) {
      const updated = await mollieUpdateSubscription(
        client.auth,
        entitlements.mollieCustomerId,
        entitlements.mollieSubscriptionId,
        { mandateId: payment.mandateId },
      );
      if (updated.ok) {
        await syncMollieSubscriptionToDb(updated.data, restaurantId);
      } else {
        console.warn(
          "billing_update_mandate subscription patch",
          updated.detail,
        );
      }
    }
    await upsertRestaurantSubscriptionAdmin({
      restaurantId,
      planId: entitlements.planId,
      interval: entitlements.interval,
      status: entitlements.status,
      source: "mollie",
      mollieCustomerId: payment.customerId,
      mollieSubscriptionId: entitlements.mollieSubscriptionId,
      mollieMandateId: payment.mandateId,
      currentPeriodEnd: entitlements.currentPeriodEnd,
      cancelAtPeriodEnd: entitlements.cancelAtPeriodEnd,
    });
    await syncMolliePaymentInvoiceToDb(payment, restaurantId);
    return { processed: true };
  }

  // Proration charge already applied plan update synchronously; keep invoice only.
  if (metadata.purpose === "billing_proration") {
    await syncMolliePaymentInvoiceToDb(payment, restaurantId);
    return { processed: true };
  }

  if (payment.subscriptionId && payment.customerId) {
    const failed =
      payment.status === "failed" || payment.status === "expired";
    const paid = payment.status === "paid";

    // Stamp before sync so preservePastDue can see the existing clock.
    if (failed) {
      await stampRestaurantPastDueSince(restaurantId);
    }

    const sub = await mollieGetSubscription(
      client.auth,
      payment.customerId,
      payment.subscriptionId,
    );
    if (sub.ok) {
      await syncMollieSubscriptionToDb(sub.data, restaurantId, {
        preservePastDue: failed,
        clearPastDue: paid,
      });
    } else if (failed) {
      const state = await loadRestaurantPeriodEndCancelState(restaurantId);
      if (state) {
        await upsertRestaurantSubscriptionAdmin({
          restaurantId,
          planId: state.planId === "free" ? "basic" : state.planId,
          interval: state.interval,
          status: "past_due",
          source: "mollie",
          mollieCustomerId: state.mollieCustomerId,
          mollieSubscriptionId: state.mollieSubscriptionId,
          mollieMandateId: state.mollieMandateId,
          currentPeriodStart: state.currentPeriodStart,
          currentPeriodEnd: state.currentPeriodEnd,
          cancelAtPeriodEnd: state.cancelAtPeriodEnd,
        });
      }
    }
  }

  await syncMolliePaymentInvoiceToDb(payment, restaurantId);
  return { processed: true };
}
