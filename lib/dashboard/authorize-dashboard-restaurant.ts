import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type DashboardRestaurantAuth =
  | { ok: true; restaurantId: string; userId: string }
  | { ok: false; error: string; status: number };

export async function authorizeDashboardRestaurant(
  restaurantId: string | null | undefined,
): Promise<DashboardRestaurantAuth> {
  const id = restaurantId?.trim() ?? "";
  if (!isUuidRestaurantId(id)) {
    return { ok: false, error: "invalid_restaurant_id", status: 400 };
  }

  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return { ok: false, error: "unauthorized", status: 401 };
  }

  const { data: isStaff, error: staffError } = await sb.rpc(
    "auth_is_restaurant_staff",
    { p_restaurant_id: id },
  );
  if (staffError || !isStaff) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, restaurantId: id, userId: user.id };
}
