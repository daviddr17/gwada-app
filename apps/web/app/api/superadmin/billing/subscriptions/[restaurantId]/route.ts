import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

const SOURCES = ["manual", "legacy", "complimentary"] as const;
const STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
  "legacy",
] as const;

type Body = {
  planId?: string;
  interval?: string;
  status?: string;
  source?: string;
  notes?: string | null;
  hasPos?: boolean;
  posInterval?: string;
};

/** Manuelles Abo setzen (Complimentary / Legacy / Korrektur) — nicht Stripe-live syncen. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ restaurantId: string }> },
) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { restaurantId } = await context.params;
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_restaurant" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const planId = body.planId ?? "free";
  const interval = body.interval ?? "month";
  const status = body.status ?? "active";
  const source = body.source ?? "manual";

  if (!isBillingPlanId(planId)) {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }
  if (!isBillingInterval(interval)) {
    return Response.json({ error: "invalid_interval" }, { status: 400 });
  }
  if (!(STATUSES as readonly string[]).includes(status)) {
    return Response.json({ error: "invalid_status" }, { status: 400 });
  }
  if (!(SOURCES as readonly string[]).includes(source)) {
    return Response.json(
      { error: "invalid_source", hint: "Nur manual/legacy/complimentary" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "admin_unavailable" }, { status: 503 });
  }

  const { error: subError } = await admin.from("restaurant_subscriptions").upsert(
    {
      restaurant_id: restaurantId,
      plan_id: planId as BillingPlanId,
      interval: interval as BillingInterval,
      status,
      source,
      notes: body.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" },
  );

  if (subError) {
    return Response.json({ error: subError.message }, { status: 500 });
  }

  if (body.hasPos === true) {
    const posInterval = isBillingInterval(body.posInterval ?? interval)
      ? (body.posInterval ?? interval)
      : interval;
    const { error: posError } = await admin
      .from("restaurant_subscription_addons")
      .upsert(
        {
          restaurant_id: restaurantId,
          addon_id: "pos",
          status: status === "legacy" ? "legacy" : "active",
          interval: posInterval,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "restaurant_id,addon_id" },
      );
    if (posError) {
      return Response.json({ error: posError.message }, { status: 500 });
    }
  } else if (body.hasPos === false) {
    await admin
      .from("restaurant_subscription_addons")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("addon_id", "pos");
  }

  return Response.json({ ok: true });
}
