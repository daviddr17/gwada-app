import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function assertChecklistProtocolApi(restaurantId: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number }
> {
  const staff = await assertRestaurantStaffApi(restaurantId);
  if (!staff.ok) return staff;

  const userSb = await createSupabaseServerClient();
  const { data: allowed, error } = await userSb.rpc(
    "auth_has_restaurant_permission",
    {
      p_restaurant_id: restaurantId,
      p_permission: "staff_todos.read",
    },
  );

  if (error) {
    console.warn("checklist protocol permission check", error.message);
    return { ok: false, error: "permission_check_failed", status: 500 };
  }

  if (!allowed) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  return { ok: true, userId: staff.userId };
}
