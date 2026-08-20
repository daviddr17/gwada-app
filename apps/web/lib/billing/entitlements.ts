import {
  BILLING_ADDONS,
  BILLING_FEATURE_KEYS,
  BILLING_PLANS,
  SIDEBAR_MODULE_BILLING_FEATURE,
  type BillingAddonId,
  type BillingFeatureKey,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { isBillingHealthyStatus } from "@/lib/billing/past-due-grace";
import type { SidebarModuleId } from "@/lib/constants/sidebar-modules";

export type RestaurantEntitlements = {
  planId: BillingPlanId;
  interval: BillingInterval;
  status: string;
  source: string;
  /** When false, plan gates are not enforced (Stripe off / misconfigured). */
  enforcing: boolean;
  addons: BillingAddonId[];
  features: BillingFeatureKey[];
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** First failed/unpaid charge of this cycle. */
  pastDueSince: string | null;
  /** pastDueSince + 7 days. */
  pastDueAccessEndsAt: string | null;
  /** Paid modules already dropped to Free. */
  pastDueGraceExpired: boolean;
};

export function featuresForPlanAndAddons(
  planId: BillingPlanId,
  addons: readonly BillingAddonId[],
): BillingFeatureKey[] {
  const set = new Set<BillingFeatureKey>(BILLING_PLANS[planId].features);
  for (const addonId of addons) {
    const addon = BILLING_ADDONS[addonId];
    if (addon) set.add(addon.feature);
  }
  return BILLING_FEATURE_KEYS.filter((k) => set.has(k));
}

export function hasBillingFeature(
  entitlements: RestaurantEntitlements | null | undefined,
  feature: BillingFeatureKey,
): boolean {
  if (!entitlements) return true;
  if (!entitlements.enforcing) return true;
  return entitlements.features.includes(feature);
}

export function hasSidebarModuleBillingAccess(
  entitlements: RestaurantEntitlements | null | undefined,
  moduleId: SidebarModuleId,
): boolean {
  const feature = SIDEBAR_MODULE_BILLING_FEATURE[moduleId];
  if (!feature) return true;
  return hasBillingFeature(entitlements, feature);
}

/** Paid plans + legacy/complimentary count as “subscribed” for upgrade CTAs. */
export function isPaidPlanActive(entitlements: RestaurantEntitlements): boolean {
  if (entitlements.planId === "free") return false;
  if (entitlements.pastDueGraceExpired) return false;
  return ["active", "trialing", "legacy", "past_due", "unpaid"].includes(
    entitlements.status,
  );
}

/** Stripe-Abo, das in-app gekündigt oder im Portal bearbeitet werden kann. */
export function hasManagedStripeSubscription(
  entitlements: RestaurantEntitlements,
): boolean {
  if (!entitlements.stripeSubscriptionId) return false;
  if (entitlements.source !== "stripe") return false;
  if (entitlements.pastDueGraceExpired) return false;
  return ["active", "trialing", "past_due", "unpaid"].includes(
    entitlements.status,
  );
}

/** In-App-Planwechsel nur bei zahlendem, nicht im Verzug befindlichem Abo. */
export function canChangeStripePlan(
  entitlements: RestaurantEntitlements,
): boolean {
  return (
    hasManagedStripeSubscription(entitlements) &&
    isBillingHealthyStatus(entitlements.status)
  );
}
