import "server-only";

import {
  isBillingAddonPurchasable,
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { nextPastDueSince } from "@/lib/billing/past-due-grace";
import {
  clearRestaurantAddonAdmin,
  clearRestaurantPastDueSince,
  findRestaurantIdByMollieSubscription,
  loadRestaurantPastDueSince,
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

export async function syncMollieSubscriptionToDb(
  sub: MollieSubscription,
  restaurantIdHint?: string | null,
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

  const status = mapMollieSubscriptionStatus(sub.status);
  const existingPastDue = await loadRestaurantPastDueSince(restaurantId);
  const pastDueSince = nextPastDueSince({
    existing: existingPastDue,
    status,
  });

  if (pastDueSince && !existingPastDue) {
    await stampRestaurantPastDueSince(restaurantId);
  } else if (!pastDueSince && existingPastDue) {
    await clearRestaurantPastDueSince(restaurantId);
  }

  const customerId = sub.customerId ?? null;
  const upserted = await upsertRestaurantSubscriptionAdmin({
    restaurantId,
    planId: planId === "free" ? "basic" : planId,
    interval,
    status,
    source: "mollie",
    mollieCustomerId: customerId,
    mollieSubscriptionId: sub.id,
    mollieMandateId: sub.mandateId ?? null,
    currentPeriodEnd: sub.nextPaymentDate
      ? new Date(`${sub.nextPaymentDate}T00:00:00.000Z`).toISOString()
      : null,
    cancelAtPeriodEnd: false,
    pastDueSince: pastDueSince ?? null,
  });

  if (!upserted.ok) return { ok: false, error: upserted.error };

  if (includePos && isBillingAddonPurchasable("pos") && status !== "canceled") {
    await upsertRestaurantAddonAdmin({
      restaurantId,
      addonId: "pos",
      status: status === "past_due" || status === "unpaid" ? status : "active",
      interval,
      currentPeriodEnd: sub.nextPaymentDate
        ? new Date(`${sub.nextPaymentDate}T00:00:00.000Z`).toISOString()
        : null,
    });
  } else if (!includePos || status === "canceled") {
    await clearRestaurantAddonAdmin(restaurantId, "pos");
  }

  return { ok: true, restaurantId };
}
