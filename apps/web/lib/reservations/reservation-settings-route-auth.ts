import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function authorizeReservationSettingsRestaurant(
  restaurantId: string,
): Promise<
  | { ok: true; sb: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { ok: false; status: number; error: string }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_restaurant" };
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const { data: allowed } = await sb.rpc("auth_is_restaurant_staff", {
    p_restaurant_id: restaurantId,
  });
  if (!allowed) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return { ok: true, sb };
}
