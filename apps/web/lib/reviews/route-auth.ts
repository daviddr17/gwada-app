import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function authorizeReviewsRestaurant(
  restaurantId: string,
): Promise<
  | { ok: true; sb: Awaited<ReturnType<typeof createSupabaseServerClient>> }
  | { ok: false; status: number }
> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400 };
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, status: 401 };

  const { data: staff } = await sb.rpc("auth_is_restaurant_staff", {
    p_restaurant_id: restaurantId,
  });
  if (!staff) return { ok: false, status: 403 };

  return { ok: true, sb };
}
