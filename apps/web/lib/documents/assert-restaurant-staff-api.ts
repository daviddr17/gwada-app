import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function assertRestaurantStaffApi(restaurantId: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();
  if (!user) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  const { data: allowed } = await userSb.rpc("auth_is_restaurant_staff", {
    p_restaurant_id: restaurantId,
  });
  if (!allowed) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, userId: user.id };
}
