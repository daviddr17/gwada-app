import "server-only";

import {
  hasBillingFeature,
  type RestaurantEntitlements,
} from "@/lib/billing/entitlements";
import type { BillingFeatureKey } from "@/lib/billing/plan-catalog";
import { loadRestaurantEntitlements } from "@/lib/billing/subscription-db";

export async function loadBillingFeatureAccess(
  restaurantId: string,
  feature: BillingFeatureKey,
): Promise<{
  entitlements: RestaurantEntitlements;
  allowed: boolean;
}> {
  const entitlements = await loadRestaurantEntitlements(restaurantId);
  return {
    entitlements,
    allowed: hasBillingFeature(entitlements, feature),
  };
}

/** API-Gate: 403 plan_required wenn Stripe erzwingt und Feature fehlt. */
export async function assertBillingFeature(
  restaurantId: string,
  feature: BillingFeatureKey,
): Promise<
  | { ok: true; entitlements: RestaurantEntitlements }
  | { ok: false; status: 403; error: "plan_required"; feature: BillingFeatureKey }
> {
  const { entitlements, allowed } = await loadBillingFeatureAccess(
    restaurantId,
    feature,
  );
  if (!allowed) {
    return { ok: false, status: 403, error: "plan_required", feature };
  }
  return { ok: true, entitlements };
}
