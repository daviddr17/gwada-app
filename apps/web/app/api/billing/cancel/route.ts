import { setRestaurantBillingCancelAtPeriodEnd } from "@/lib/billing/manage-subscription";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    cancel?: boolean;
  };

  const restaurantId = body.restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "billing.manage");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await setRestaurantBillingCancelAtPeriodEnd({
      restaurantId,
      cancel: body.cancel !== false,
    });
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.warn(
      "setRestaurantBillingCancelAtPeriodEnd",
      err instanceof Error ? err.message : err,
    );
    return Response.json({ error: "cancel_failed" }, { status: 500 });
  }
}
