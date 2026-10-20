import "server-only";

import {
  featuresForPlanAndAddons,
  type RestaurantEntitlements,
} from "@/lib/billing/entitlements";
import {
  isBillingDunningStatus,
  isPastDueAccessLocked,
  isPastDueGraceExpired,
  pastDueAccessEndsAt,
  shouldGrantPaidPlanFeatures,
} from "@/lib/billing/past-due-grace";
import {
  isBillingPlanId,
  type BillingAddonId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { fetchPlatformMollieBillingAdmin } from "@/lib/billing/mollie-server";
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
  mollie_customer_id: string | null;
  mollie_subscription_id: string | null;
  mollie_mandate_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  past_due_since: string | null;
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
    .filter((r) =>
      ["active", "legacy", "past_due", "unpaid"].includes(r.status),
    )
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
  const platform = await fetchPlatformMollieBillingAdmin();
  const enforcing = Boolean(platform.enabled && platform.api_key);

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
      mollieCustomerId: null,
      mollieSubscriptionId: null,
      pastDueSince: null,
      pastDueAccessEndsAt: null,
      pastDueGraceExpired: false,
    };
  }

  await ensureRestaurantSubscriptionRow(restaurantId);

  const subSelectWithGrace =
    "restaurant_id, plan_id, interval, status, source, stripe_customer_id, stripe_subscription_id, stripe_price_id, mollie_customer_id, mollie_subscription_id, mollie_mandate_id, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, past_due_since";
  const subSelectBase =
    "restaurant_id, plan_id, interval, status, source, stripe_customer_id, stripe_subscription_id, stripe_price_id, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at";

  const [{ data: sub, error: subError }, { data: addons }] = await Promise.all([
    admin
      .from("restaurant_subscriptions")
      .select(subSelectWithGrace)
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    admin
      .from("restaurant_subscription_addons")
      .select("restaurant_id, addon_id, status, interval")
      .eq("restaurant_id", restaurantId),
  ]);

  let row = (sub as SubRow | null) ?? null;
  if (subError) {
    console.warn("loadRestaurantEntitlements", subError.message);
    const retry = await admin
      .from("restaurant_subscriptions")
      .select(subSelectBase)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    row = retry.data
      ? ({
          ...(retry.data as Omit<
            SubRow,
            "past_due_since" | "mollie_customer_id" | "mollie_subscription_id" | "mollie_mandate_id"
          >),
          past_due_since: null,
          mollie_customer_id: null,
          mollie_subscription_id: null,
          mollie_mandate_id: null,
        } as SubRow)
      : null;
  }

  const planId = asPlanId(row?.plan_id ?? "free");
  let pastDueSince = row?.past_due_since ?? null;
  if (
    (row?.source === "mollie" || row?.source === "stripe") &&
    isBillingDunningStatus(row.status) &&
    !pastDueSince
  ) {
    await stampRestaurantPastDueSince(restaurantId);
    pastDueSince =
      (await loadRestaurantPastDueSince(restaurantId)) ??
      new Date().toISOString();
  }

  const grantPaid = shouldGrantPaidPlanFeatures({
    source: row?.source ?? "manual",
    status: row?.status ?? "active",
    pastDueSince,
  });
  const graceExpired = isPastDueAccessLocked({
    source: row?.source ?? "manual",
    status: row?.status ?? "active",
    pastDueSince,
  });
  const addonIds = grantPaid
    ? activeAddonIds((addons ?? []) as AddonRow[])
    : [];
  const featurePlanId = grantPaid ? planId : "free";

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
    features: featuresForPlanAndAddons(featurePlanId, addonIds),
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    currentPeriodEnd: row?.current_period_end ?? null,
    stripeCustomerId: row?.stripe_customer_id ?? null,
    stripeSubscriptionId: row?.stripe_subscription_id ?? null,
    mollieCustomerId: row?.mollie_customer_id ?? null,
    mollieSubscriptionId: row?.mollie_subscription_id ?? null,
    pastDueSince,
    pastDueAccessEndsAt: pastDueAccessEndsAt(pastDueSince),
    pastDueGraceExpired: graceExpired,
  };
}

export async function upsertRestaurantSubscriptionAdmin(input: {
  restaurantId: string;
  planId: BillingPlanId;
  interval: BillingInterval;
  status: string;
  source: "stripe" | "mollie" | "manual" | "legacy" | "complimentary";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  mollieCustomerId?: string | null;
  mollieSubscriptionId?: string | null;
  mollieMandateId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  /** `undefined` = Spalte nicht anfassen; `null` = leeren. */
  pastDueSince?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const payload: Record<string, unknown> = {
    restaurant_id: input.restaurantId,
    plan_id: input.planId,
    interval: input.interval,
    status: input.status,
    source: input.source,
    current_period_start: input.currentPeriodStart ?? null,
    current_period_end: input.currentPeriodEnd ?? null,
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    updated_at: new Date().toISOString(),
  };

  if (input.stripeCustomerId !== undefined) {
    payload.stripe_customer_id = input.stripeCustomerId;
  }
  if (input.stripeSubscriptionId !== undefined) {
    payload.stripe_subscription_id = input.stripeSubscriptionId;
  }
  if (input.stripePriceId !== undefined) {
    payload.stripe_price_id = input.stripePriceId;
  }
  if (input.mollieCustomerId !== undefined) {
    payload.mollie_customer_id = input.mollieCustomerId;
  }
  if (input.mollieSubscriptionId !== undefined) {
    payload.mollie_subscription_id = input.mollieSubscriptionId;
  }
  if (input.mollieMandateId !== undefined) {
    payload.mollie_mandate_id = input.mollieMandateId;
  }
  if (input.pastDueSince !== undefined) {
    payload.past_due_since = input.pastDueSince;
  }

  const { error } = await admin
    .from("restaurant_subscriptions")
    .upsert(payload, { onConflict: "restaurant_id" });

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

export async function findRestaurantIdByMollieCustomer(
  customerId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_subscriptions")
    .select("restaurant_id")
    .eq("mollie_customer_id", customerId)
    .maybeSingle();
  return (data?.restaurant_id as string | undefined) ?? null;
}

export async function findRestaurantIdByMollieSubscription(
  subscriptionId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_subscriptions")
    .select("restaurant_id")
    .eq("mollie_subscription_id", subscriptionId)
    .maybeSingle();
  return (data?.restaurant_id as string | undefined) ?? null;
}

export async function loadRestaurantPastDueSince(
  restaurantId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_subscriptions")
    .select("past_due_since")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return (data?.past_due_since as string | null | undefined) ?? null;
}

/** Keep the first failure timestamp in this unpaid cycle. */
export async function stampRestaurantPastDueSince(
  restaurantId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const now = new Date().toISOString();
  await admin
    .from("restaurant_subscriptions")
    .update({ past_due_since: now, updated_at: now })
    .eq("restaurant_id", restaurantId)
    .is("past_due_since", null);
}

export async function clearRestaurantPastDueSince(
  restaurantId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("restaurant_subscriptions")
    .update({
      past_due_since: null,
      updated_at: new Date().toISOString(),
    })
    .eq("restaurant_id", restaurantId)
    .not("past_due_since", "is", null);
}

export async function listMollieLinkedSubscriptions(): Promise<
  {
    restaurantId: string;
    mollieSubscriptionId: string;
    mollieCustomerId: string | null;
    interval: string;
  }[]
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("restaurant_subscriptions")
    .select(
      "restaurant_id, mollie_subscription_id, mollie_customer_id, interval, source",
    )
    .eq("source", "mollie")
    .not("mollie_subscription_id", "is", null);

  if (error || !data) return [];
  return data.flatMap((row) => {
    const restaurantId = row.restaurant_id as string;
    const mollieSubscriptionId = row.mollie_subscription_id as string | null;
    if (!restaurantId || !mollieSubscriptionId) return [];
    return [
      {
        restaurantId,
        mollieSubscriptionId,
        mollieCustomerId: (row.mollie_customer_id as string | null) ?? null,
        interval: (row.interval as string) ?? "month",
      },
    ];
  });
}

export type PastDueGraceExpiredRow = {
  restaurantId: string;
  mollieSubscriptionId: string;
  mollieCustomerId: string | null;
  pastDueSince: string;
};

export async function listMollieSubscriptionsPastDueGraceExpired(
  now: Date = new Date(),
): Promise<PastDueGraceExpiredRow[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("restaurant_subscriptions")
    .select(
      "restaurant_id, mollie_subscription_id, mollie_customer_id, past_due_since, source, status",
    )
    .eq("source", "mollie")
    .not("past_due_since", "is", null)
    .not("mollie_subscription_id", "is", null)
    .neq("status", "canceled");

  if (error || !data) return [];
  return data.flatMap((row) => {
    const restaurantId = row.restaurant_id as string;
    const mollieSubscriptionId = row.mollie_subscription_id as string | null;
    const mollieCustomerId = (row.mollie_customer_id as string | null) ?? null;
    const pastDueSince = row.past_due_since as string | null;
    if (!restaurantId || !mollieSubscriptionId || !pastDueSince) return [];
    if (!isPastDueGraceExpired(pastDueSince, now)) return [];
    return [
      { restaurantId, mollieSubscriptionId, mollieCustomerId, pastDueSince },
    ];
  });
}
