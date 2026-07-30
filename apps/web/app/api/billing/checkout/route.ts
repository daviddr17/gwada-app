import {
  createBillingCheckoutSession,
} from "@/lib/billing/checkout";
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
    includePos?: boolean;
    successUrl?: string;
    cancelUrl?: string;
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
  if (!isBillingPlanId(planId) || planId === "free" || !isBillingInterval(interval)) {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const successUrl =
    body.successUrl?.trim() ||
    `${origin}/dashboard/settings/abo?checkout=success`;
  const cancelUrl =
    body.cancelUrl?.trim() ||
    `${origin}/dashboard/settings/abo?checkout=cancel`;

  const {
    data: { user },
  } = await auth.sb.auth.getUser();

  const result = await createBillingCheckoutSession({
    restaurantId,
    planId: planId as Exclude<BillingPlanId, "free">,
    interval: interval as BillingInterval,
    includePos: body.includePos === true,
    successUrl,
    cancelUrl,
    customerEmail: user?.email ?? null,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ url: result.url });
}
