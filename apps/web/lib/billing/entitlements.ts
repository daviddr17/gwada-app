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
  return ["active", "trialing", "legacy", "past_due"].includes(
    entitlements.status,
  );
}
