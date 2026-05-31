import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function assertRestaurantPermissionApi(
  restaurantId: string,
  permission: RestaurantPermissionKey,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number }
> {
  const staff = await assertRestaurantStaffApi(restaurantId);
  if (!staff.ok) return staff;

  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const userSb = await createSupabaseServerClient();
  const { data: allowed, error } = await userSb.rpc(
    "auth_has_restaurant_permission",
    {
      p_restaurant_id: restaurantId,
      p_permission: permission,
    },
  );

  if (error) {
    console.warn("auth_has_restaurant_permission", error.message);
    return { ok: false, error: "permission_check_failed", status: 500 };
  }

  if (!allowed) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, userId: staff.userId };
}
