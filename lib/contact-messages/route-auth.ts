import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function authorizeContactMessagesRestaurant(
  restaurantIdRaw: string | null,
): Promise<
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      restaurantId: string;
      userId: string;
    }
  | { ok: false; status: number; error: string }
> {
  const restaurantId = restaurantIdRaw?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_request" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const { data: allowed } = await supabase.rpc("auth_is_restaurant_staff", {
    p_restaurant_id: restaurantId,
  });
  if (!allowed) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, supabase, restaurantId, userId: user.id };
}
