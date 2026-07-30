import { loadRestaurantEntitlements } from "@/lib/billing/subscription-db";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

/**
 * Entitlements for sidebar + Abo UI.
 * Readable by any authenticated restaurant member (not only billing.manage),
 * so module gates can run for everyone.
 */
export async function GET(req: Request) {
  const restaurantId = new URL(req.url).searchParams.get("restaurantId")?.trim();
  if (!restaurantId || !isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: member } = await sb
    .from("restaurant_employees")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) {
    const auth = await authorizeRestaurantModule(
      restaurantId,
      "billing.manage",
    );
    if (!auth.ok) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const entitlements = await loadRestaurantEntitlements(restaurantId);
  return Response.json({ entitlements });
}
