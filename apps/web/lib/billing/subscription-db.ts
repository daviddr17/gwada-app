import "server-only";

import {
  featuresForPlanAndAddons,
  type RestaurantEntitlements,
} from "@/lib/billing/entitlements";
import {
  isBillingPlanId,
  type BillingAddonId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { getStripePlatform } from "@/lib/billing/stripe-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SubRow = {
  restaurant_id: string;
  plan_id: string;
  interval: string;
  status: string;
  source: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
};

type AddonRow = {
  restaurant_id: string;
  addon_id: string;
  status: string;
  interval: string;
};

function asPlanId(value: string): BillingPlanId {
  return isBillingPlanId(value) ? value : "free";
}

function asInterval(value: string): BillingInterval {
  return value === "year" ? "year" : "month";
}

function activeAddonIds(rows: AddonRow[]): BillingAddonId[] {
  return rows
    .filter((r) => ["active", "legacy", "past_due"].includes(r.status))
    .map((r) => r.addon_id)
    .filter((id): id is BillingAddonId => id === "pos");
}

export async function ensureRestaurantSubscriptionRow(
  restaurantId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("restaurant_subscriptions").upsert(
    {
      restaurant_id: restaurantId,
      plan_id: "free",
      interval: "month",
      status: "active",
      source: "manual",
    },
    { onConflict: "restaurant_id", ignoreDuplicates: true },
  );
}

export async function loadRestaurantEntitlements(
  restaurantId: string,
): Promise<RestaurantEntitlements> {
  const platform = await getStripePlatform();
  const enforcing = Boolean(platform.enabled && platform.secret_key);

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      planId: "pro",
      interval: "month",
      status: "legacy",
      source: "legacy",
      enforcing: false,
      addons: ["pos"],
      features: featuresForPlanAndAddons("pro", ["pos"]),
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  }

  await ensureRestaurantSubscriptionRow(restaurantId);

  const [{ data: sub }, { data: addons }] = await Promise.all([
    admin
      .from("restaurant_subscriptions")
      .select(
        "restaurant_id, plan_id, interval, status, source, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at",
      )
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    admin
      .from("restaurant_subscription_addons")
      .select("restaurant_id, addon_id, status, interval")
      .eq("restaurant_id", restaurantId),
  ]);

  const row = sub as SubRow | null;
  const planId = asPlanId(row?.plan_id ?? "free");
  const addonIds = activeAddonIds((addons ?? []) as AddonRow[]);

  // Legacy / complimentary always keep full access even if Stripe is on.
  const effectiveEnforcing =
    enforcing &&
    row?.source !== "legacy" &&
    row?.source !== "complimentary" &&
    row?.status !== "legacy";

  return {
    planId,
    interval: asInterval(row?.interval ?? "month"),
    status: row?.status ?? "active",
    source: row?.source ?? "manual",
    enforcing: effectiveEnforcing,
    addons: addonIds,
    features: featuresForPlanAndAddons(planId, addonIds),
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    currentPeriodEnd: row?.current_period_end ?? null,
    stripeCustomerId: row?.stripe_customer_id ?? null,
    stripeSubscriptionId: row?.stripe_subscription_id ?? null,
  };
}

export async function upsertRestaurantSubscriptionAdmin(input: {
  restaurantId: string;
  planId: BillingPlanId;
  interval: BillingInterval;
  status: string;
  source: "stripe" | "manual" | "legacy" | "complimentary";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const { error } = await admin.from("restaurant_subscriptions").upsert(
    {
      restaurant_id: input.restaurantId,
      plan_id: input.planId,
      interval: input.interval,
      status: input.status,
      source: input.source,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      stripe_price_id: input.stripePriceId ?? null,
      current_period_start: input.currentPeriodStart ?? null,
      current_period_end: input.currentPeriodEnd ?? null,
      cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertRestaurantAddonAdmin(input: {
  restaurantId: string;
  addonId: BillingAddonId;
  status: string;
  interval: BillingInterval;
  stripeSubscriptionItemId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const { error } = await admin.from("restaurant_subscription_addons").upsert(
    {
      restaurant_id: input.restaurantId,
      addon_id: input.addonId,
      status: input.status,
      interval: input.interval,
      stripe_subscription_item_id: input.stripeSubscriptionItemId ?? null,
      stripe_price_id: input.stripePriceId ?? null,
      current_period_end: input.currentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id,addon_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function clearRestaurantAddonAdmin(
  restaurantId: string,
  addonId: BillingAddonId,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("restaurant_subscription_addons")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId)
    .eq("addon_id", addonId);
}

export async function findRestaurantIdByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_subscriptions")
    .select("restaurant_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data?.restaurant_id as string | undefined) ?? null;
}

export async function findRestaurantIdByStripeSubscription(
  subscriptionId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_subscriptions")
    .select("restaurant_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  return (data?.restaurant_id as string | undefined) ?? null;
}
