import { updateRestaurantBillingPlan } from "@/lib/billing/manage-subscription";
import {
  isBillingInterval,
  isBillingPlanId,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    planId?: string;
    interval?: string;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "billing.manage");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const planId = body.planId?.trim() ?? "";
  const interval = body.interval?.trim() ?? "";
  if (
    !isBillingPlanId(planId) ||
    planId === "free" ||
    !isBillingInterval(interval)
  ) {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  try {
    const result = await updateRestaurantBillingPlan({
      restaurantId,
      planId: planId as Exclude<BillingPlanId, "free">,
      interval: interval as BillingInterval,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.warn(
      "updateRestaurantBillingPlan",
      err instanceof Error ? err.message : err,
    );
    return Response.json({ error: "plan_change_failed" }, { status: 500 });
  }
}
