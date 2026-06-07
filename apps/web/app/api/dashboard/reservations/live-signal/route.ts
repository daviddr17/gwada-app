import { fetchReservationsLiveSignal } from "@/lib/reservations/reservations-live-signal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId =
    new URL(req.url).searchParams.get("restaurantId")?.trim() ?? "";
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

  const signal = await fetchReservationsLiveSignal(sb, restaurantId);
  return Response.json(signal, {
    headers: { "Cache-Control": "no-store" },
  });
}
