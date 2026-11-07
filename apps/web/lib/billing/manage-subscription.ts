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
import { computePlanChangeProration } from "@/lib/billing/plan-change-proration";
import { syncMolliePaymentInvoiceToDb } from "@/lib/billing/sync-mollie-invoice";
import { syncMollieSubscriptionToDb } from "@/lib/billing/sync-mollie-subscription";
import {
  loadRestaurantEntitlements,
  loadRestaurantMollieMandateId,
  loadRestaurantPeriodEndCancelState,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import { mollieAmountEur } from "@/lib/mollie/mollie-amount";
import { getPublicSiteUrl } from "@/lib/public-env";
import {
  mollieCancelSubscription,
  mollieCreatePayment,
  mollieCreateSubscription,
  mollieGetSubscription,
  mollieUpdateSubscription,
} from "@/lib/mollie/mollie-payments";

function billingWebhookUrl(): string {
  const site = getPublicSiteUrl() || "https://gwada.app";
  return `${site}/api/billing/mollie/webhook`;
}

/** Mollie startDate is YYYY-MM-DD and must be today or later (UTC). */
function mollieStartDateFromPeriodEnd(
  periodEndIso: string | null,
): string | undefined {
  if (!periodEndIso) return undefined;
  const ms = Date.parse(periodEndIso);
  if (!Number.isFinite(ms)) return undefined;
  const ymd = new Date(ms).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (ymd < today) return undefined;
  return ymd;
}

function paidPlanId(
  planId: BillingPlanId,
): Exclude<BillingPlanId, "free"> | null {
  if (planId === "free" || !isBillingPlanId(planId)) return null;
  return planId;
}

async function recreateMollieSubscription(input: {
  restaurantId: string;
  customerId: string;
  mandateId: string | null;
  planId: Exclude<BillingPlanId, "free">;
  interval: BillingInterval;
  includePos: boolean;
  startDate?: string;
}): Promise<{ ok: true; subscriptionId: string } | { ok: false; error: string; status: number }> {
  const client = await getMollieBillingAuth();
  if (!client) {
    return { ok: false, error: "mollie_not_configured", status: 503 };
  }

  const amount = mollieBillingAmount(
    input.planId,
    input.interval,
    input.includePos,
  );
  const description = billingSubscriptionDescription({
    planId: input.planId,
    interval: input.interval,
    includePos: input.includePos,
  });

  const created = await mollieCreateSubscription(
    client.auth,
    input.customerId,
    {
      amount,
      interval: billingSubscriptionInterval(input.interval),
      description,
      webhookUrl: billingWebhookUrl(),
      ...(input.mandateId ? { mandateId: input.mandateId } : {}),
      ...(input.startDate ? { startDate: input.startDate } : {}),
      metadata: {
        restaurant_id: input.restaurantId,
        plan_id: input.planId,
        interval: input.interval,
        include_pos: input.includePos ? "1" : "0",
      },
    },
  );

  if (!created.ok) {
    console.warn("mollie subscription recreate", created.error, created.status);
    return {
      ok: false,
      error: "subscription_recreate_failed",
      status: 502,
    };
  }

  const synced = await syncMollieSubscriptionToDb(
    {
      ...created.data,
      status: "active",
      customerId: input.customerId,
      mandateId: input.mandateId ?? created.data.mandateId,
      metadata: {
        restaurant_id: input.restaurantId,
        plan_id: input.planId,
        interval: input.interval,
        include_pos: input.includePos ? "1" : "0",
      },
    },
    input.restaurantId,
    { cancelAtPeriodEnd: false },
  );
  if (!synced.ok) {
    return { ok: false, error: synced.error, status: 500 };
  }
  return { ok: true, subscriptionId: created.data.id };
}

export async function updateRestaurantBillingPlan(input: {
  restaurantId: string;
  planId: Exclude<BillingPlanId, "free">;
  interval: BillingInterval;
}): Promise<
  | { ok: true; proration?: { chargeNowEuros: number; unusedCreditEuros: number } }
  | { ok: false; error: string; status: number }
> {
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

  const currentPlan = paidPlanId(entitlements.planId);
  if (!currentPlan) {
    return { ok: false, error: "no_managed_subscription", status: 409 };
  }

  const includePos = entitlements.addons.includes("pos");
  const amount = mollieBillingAmount(input.planId, input.interval, includePos);
  const description = billingSubscriptionDescription({
    planId: input.planId,
    interval: input.interval,
    includePos,
  });

  // Pending period-end cancel already deleted the Mollie sub — recreate instead of PATCH.
  if (entitlements.cancelAtPeriodEnd) {
    const mandateId = await loadRestaurantMollieMandateId(input.restaurantId);
    const recreated = await recreateMollieSubscription({
      restaurantId: input.restaurantId,
      customerId: entitlements.mollieCustomerId,
      mandateId,
      planId: input.planId,
      interval: input.interval,
      includePos,
      startDate: mollieStartDateFromPeriodEnd(entitlements.currentPeriodEnd),
    });
    if (!recreated.ok) return recreated;
    return { ok: true };
  }

  const periodState = await loadRestaurantPeriodEndCancelState(
    input.restaurantId,
  );
  const periodEndIso =
    entitlements.currentPeriodEnd ?? periodState?.currentPeriodEnd ?? null;

  let proration:
    | { chargeNowEuros: number; unusedCreditEuros: number }
    | undefined;

  if (periodEndIso) {
    const calc = computePlanChangeProration({
      currentPlanId: currentPlan,
      currentInterval: entitlements.interval,
      newPlanId: input.planId,
      newInterval: input.interval,
      includePos,
      periodEndIso,
      periodStartIso: periodState?.currentPeriodStart,
    });
    proration = {
      chargeNowEuros: calc.chargeNowEuros,
      unusedCreditEuros: calc.unusedCreditEuros,
    };

    if (calc.chargeNowEuros > 0) {
      const mandateId =
        (await loadRestaurantMollieMandateId(input.restaurantId)) ??
        periodState?.mollieMandateId ??
        null;
      if (!mandateId) {
        return { ok: false, error: "mandate_required", status: 409 };
      }

      const charged = await mollieCreatePayment(client.auth, {
        amount: mollieAmountEur(calc.chargeNowEuros),
        customerId: entitlements.mollieCustomerId,
        mandateId,
        sequenceType: "recurring",
        description: `Gwada Planwechsel — anteilig (${calc.chargeNowEuros.toFixed(2)} €)`,
        webhookUrl: billingWebhookUrl(),
        ...(client.config.profile_id
          ? { profileId: client.config.profile_id }
          : {}),
        metadata: {
          restaurant_id: input.restaurantId,
          plan_id: input.planId,
          interval: input.interval,
          include_pos: includePos ? "1" : "0",
          purpose: "billing_proration",
          period_start: calc.periodStartIso,
          period_end: calc.periodEndIso,
          unused_credit_euros: String(calc.unusedCreditEuros),
        },
      });

      if (!charged.ok) {
        console.warn("mollie proration charge", charged.error, charged.status);
        return {
          ok: false,
          error: "proration_charge_failed",
          status: 502,
        };
      }
      if (charged.data.status !== "paid") {
        return {
          ok: false,
          error: "proration_payment_incomplete",
          status: 402,
        };
      }
      await syncMolliePaymentInvoiceToDb(charged.data, input.restaurantId);
    }
  }

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
    console.warn("mollie plan update", updated.error, updated.status);
    return {
      ok: false,
      error: "plan_update_failed",
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
  return { ok: true, proration };
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
    console.warn("mollie immediate cancel", canceled.error, canceled.status);
    return {
      ok: false,
      error: "cancel_failed",
      status: 502,
    };
  }

  const synced = await syncMollieSubscriptionToDb(
    canceled.data,
    input.restaurantId,
    { forceImmediateCancel: true },
  );
  if (!synced.ok) {
    return { ok: false, error: synced.error, status: 500 };
  }
  return { ok: true };
}

/**
 * Period-end cancel for Mollie SaaS billing.
 * cancel=true → stop future Mollie charges now, keep paid access until currentPeriodEnd.
 * cancel=false → undo by recreating the Mollie subscription (mandate + startDate).
 */
export async function setRestaurantBillingCancelAtPeriodEnd(input: {
  restaurantId: string;
  cancel: boolean;
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

  const planId = paidPlanId(entitlements.planId);
  if (!planId) {
    return { ok: false, error: "no_managed_subscription", status: 409 };
  }

  if (!input.cancel) {
    if (!entitlements.cancelAtPeriodEnd) {
      return { ok: true };
    }
    const mandateId = await loadRestaurantMollieMandateId(input.restaurantId);
    const recreated = await recreateMollieSubscription({
      restaurantId: input.restaurantId,
      customerId: entitlements.mollieCustomerId,
      mandateId,
      planId,
      interval: entitlements.interval,
      includePos: entitlements.addons.includes("pos"),
      startDate: mollieStartDateFromPeriodEnd(entitlements.currentPeriodEnd),
    });
    if (!recreated.ok) return recreated;
    return { ok: true };
  }

  if (entitlements.cancelAtPeriodEnd) {
    return { ok: true };
  }

  const current = await mollieGetSubscription(
    client.auth,
    entitlements.mollieCustomerId,
    entitlements.mollieSubscriptionId,
  );

  let mandateId = await loadRestaurantMollieMandateId(input.restaurantId);
  let periodEnd = entitlements.currentPeriodEnd;

  if (current.ok) {
    mandateId = current.data.mandateId ?? mandateId;
    if (current.data.nextPaymentDate) {
      periodEnd = new Date(
        `${current.data.nextPaymentDate}T00:00:00.000Z`,
      ).toISOString();
    }
    if (current.data.status !== "canceled") {
      const canceled = await mollieCancelSubscription(
        client.auth,
        entitlements.mollieCustomerId,
        entitlements.mollieSubscriptionId,
      );
      if (!canceled.ok) {
        console.warn("mollie period-end cancel", canceled.error, canceled.status);
        return {
          ok: false,
          error: "cancel_failed",
          status: 502,
        };
      }
      mandateId = canceled.data.mandateId ?? mandateId;
    }
  } else if (current.status !== 404) {
    console.warn("mollie cancel get subscription", current.error, current.status);
    return {
      ok: false,
      error: "cancel_failed",
      status: 502,
    };
  }

  const upserted = await upsertRestaurantSubscriptionAdmin({
    restaurantId: input.restaurantId,
    planId,
    interval: entitlements.interval,
    status:
      entitlements.status === "canceled" ? "active" : entitlements.status,
    source: "mollie",
    mollieCustomerId: entitlements.mollieCustomerId,
    mollieSubscriptionId: entitlements.mollieSubscriptionId,
    mollieMandateId: mandateId,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: true,
  });
  if (!upserted.ok) {
    return { ok: false, error: upserted.error, status: 500 };
  }
  return { ok: true };
}
