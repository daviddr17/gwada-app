import { loadRestaurantFiscalOverview } from "@/lib/pos/restaurant-fiscal-overview-server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const restaurantId =
    new URL(request.url).searchParams.get("restaurantId")?.trim() ?? "";

  if (!isUuidRestaurantId(restaurantId)) {
    return Response.json({ error: "invalid_restaurant_id" }, { status: 400 });
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: isStaff, error: staffError } = await sb.rpc(
    "auth_is_restaurant_staff",
    { p_restaurant_id: restaurantId },
  );

  if (staffError || !isStaff) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const overview = await loadRestaurantFiscalOverview(sb, restaurantId);
  return Response.json(overview);
}
