import "server-only";

import {
  isBillingAddonPurchasable,
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { nextPastDueSince } from "@/lib/billing/past-due-grace";
import { subtractBillingInterval } from "@/lib/billing/plan-change-proration";
import {
  clearRestaurantAddonAdmin,
  clearRestaurantPastDueSince,
  findRestaurantIdByMollieSubscription,
  loadRestaurantPastDueSince,
  loadRestaurantPeriodEndCancelState,
  stampRestaurantPastDueSince,
  upsertRestaurantAddonAdmin,
  upsertRestaurantSubscriptionAdmin,
} from "@/lib/billing/subscription-db";
import {
  mapMollieSubscriptionStatus,
  type MollieSubscription,
} from "@/lib/mollie/mollie-payments";

function metaString(
  metadata: Record<string, string> | null | undefined,
  key: string,
): string | null {
  const v = metadata?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export type SyncMollieSubscriptionOptions = {
  /** Explicit cancel_at_period_end; default preserves DB when Mollie still active. */
  cancelAtPeriodEnd?: boolean;
  /** Skip soft period-end hold — mark canceled/free immediately. */
  forceImmediateCancel?: boolean;
  /**
   * Failed renewal while Mollie still reports active/pending:
   * keep past_due stamp + local past_due status so the 7-day grace is not wiped.
   */
  preservePastDue?: boolean;
  /** Successful paid renewal — clear any local past_due cycle. */
  clearPastDue?: boolean;
};

function periodEndStillActive(periodEndIso: string | null, now = new Date()): boolean {
  if (!periodEndIso) return false;
  const ms = Date.parse(periodEndIso);
  if (!Number.isFinite(ms)) return false;
  return ms > now.getTime();
}

export async function syncMollieSubscriptionToDb(
  sub: MollieSubscription,
  restaurantIdHint?: string | null,
  options?: SyncMollieSubscriptionOptions,
): Promise<{ ok: true; restaurantId: string } | { ok: false; error: string }> {
  const restaurantId =
    restaurantIdHint ??
    metaString(sub.metadata, "restaurant_id") ??
    (await findRestaurantIdByMollieSubscription(sub.id));

  if (!restaurantId) {
    return { ok: false, error: "restaurant_not_found" };
  }

  const planRaw = metaString(sub.metadata, "plan_id") ?? "basic";
  const planId: BillingPlanId = isBillingPlanId(planRaw) ? planRaw : "basic";
  const intervalRaw = metaString(sub.metadata, "interval") ?? "month";
  const interval: BillingInterval = isBillingInterval(intervalRaw)
    ? intervalRaw
    : "month";
  const includePos = metaString(sub.metadata, "include_pos") === "1";

  let status = mapMollieSubscriptionStatus(sub.status);
  const existing = await loadRestaurantPeriodEndCancelState(restaurantId);
  const molliePeriodEnd = sub.nextPaymentDate
    ? new Date(`${sub.nextPaymentDate}T00:00:00.000Z`).toISOString()
    : null;

  let cancelAtPeriodEnd =
    options?.cancelAtPeriodEnd ?? existing?.cancelAtPeriodEnd ?? false;
  let currentPeriodEnd = molliePeriodEnd ?? existing?.currentPeriodEnd ?? null;
  let currentPeriodStart =
    existing?.currentPeriodStart ??
    (currentPeriodEnd
      ? subtractBillingInterval(currentPeriodEnd, interval)
      : null);
  let effectivePlanId: BillingPlanId = planId === "free" ? "basic" : planId;
  let softPeriodEndHold = false;

  // Soft cancel: Mollie already stopped, paid access until local period end.
  if (
    status === "canceled" &&
    !options?.forceImmediateCancel &&
    (options?.cancelAtPeriodEnd === true ||
      existing?.cancelAtPeriodEnd === true) &&
    periodEndStillActive(currentPeriodEnd ?? existing?.currentPeriodEnd ?? null)
  ) {
    softPeriodEndHold = true;
    cancelAtPeriodEnd = true;
    currentPeriodEnd = existing?.currentPeriodEnd ?? currentPeriodEnd;
    currentPeriodStart = existing?.currentPeriodStart ?? currentPeriodStart;
    status =
      existing?.status && existing.status !== "canceled"
        ? existing.status
        : "active";
    if (existing?.planId && existing.planId !== "free") {
      effectivePlanId = existing.planId;
    }
  } else if (status === "canceled") {
    cancelAtPeriodEnd = false;
    effectivePlanId = "free";
  } else {
    // Active Mollie subscription ⇒ not pending period-end cancel (unless caller forces).
    cancelAtPeriodEnd = options?.cancelAtPeriodEnd ?? false;
    if (molliePeriodEnd) {
      currentPeriodEnd = molliePeriodEnd;
      currentPeriodStart = subtractBillingInterval(molliePeriodEnd, interval);
    }
  }

  const existingPastDue = await loadRestaurantPastDueSince(restaurantId);

  // Failed charge while Mollie still says active: keep dunning locally.
  if (
    options?.preservePastDue &&
    existingPastDue &&
    (status === "active" || status === "incomplete")
  ) {
    status = "past_due";
  }

  let pastDueSince: string | null;
  if (options?.clearPastDue) {
    pastDueSince = null;
  } else {
    pastDueSince = nextPastDueSince({
      existing: existingPastDue,
      status,
      latestInvoiceOpen: Boolean(
        options?.preservePastDue && existingPastDue,
      ),
    });
  }

  if (pastDueSince && !existingPastDue) {
    await stampRestaurantPastDueSince(restaurantId);
  } else if (!pastDueSince && existingPastDue) {
    await clearRestaurantPastDueSince(restaurantId);
  }

  const customerId = sub.customerId ?? null;
  const effectiveInterval =
    status !== "canceled" && cancelAtPeriodEnd && existing?.interval
      ? existing.interval
      : interval;
  const upserted = await upsertRestaurantSubscriptionAdmin({
    restaurantId,
    planId: effectivePlanId,
    interval: effectiveInterval,
    status,
    source: "mollie",
    mollieCustomerId: customerId,
    mollieSubscriptionId: sub.id,
    mollieMandateId: sub.mandateId ?? existing?.mollieMandateId ?? null,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    pastDueSince: pastDueSince ?? null,
  });

  if (!upserted.ok) return { ok: false, error: upserted.error };

  // Soft hold: leave add-ons alone (Mollie metadata may be sparse after cancel).
  if (!softPeriodEndHold) {
    if (
      includePos &&
      isBillingAddonPurchasable("pos") &&
      status !== "canceled" &&
      effectivePlanId !== "free"
    ) {
      await upsertRestaurantAddonAdmin({
        restaurantId,
        addonId: "pos",
        status: status === "past_due" || status === "unpaid" ? status : "active",
        interval: effectiveInterval,
        currentPeriodEnd,
      });
    } else if (
      !includePos ||
      status === "canceled" ||
      effectivePlanId === "free"
    ) {
      await clearRestaurantAddonAdmin(restaurantId, "pos");
    }
  }

  return { ok: true, restaurantId };
}
