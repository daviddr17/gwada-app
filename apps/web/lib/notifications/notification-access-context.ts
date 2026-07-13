import "server-only";

import {
  type NotificationModuleAccessContext,
} from "@/lib/notifications/notification-module-permissions";
import { hasModuleRead } from "@/lib/permissions/module-crud-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffShiftBellScope = "team" | "own";

export async function loadNotificationAccessContext(
  sb: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{
  access: NotificationModuleAccessContext;
  shiftScope: StaffShiftBellScope;
}> {
  const [keysRes, staffRes] = await Promise.all([
    sb.rpc("auth_user_restaurant_permission_keys", {
      p_restaurant_id: params.restaurantId,
    }),
    sb
      .from("restaurant_staff")
      .select("id")
      .eq("restaurant_id", params.restaurantId)
      .eq("profile_id", params.userId)
      .maybeSingle(),
  ]);

  const keySet = new Set((keysRes.data ?? []) as RestaurantPermissionKey[]);
  const has = (key: RestaurantPermissionKey) => keySet.has(key);
  const hasStaffProfile = Boolean(staffRes.data);
  const access: NotificationModuleAccessContext = { has, hasStaffProfile };
  const shiftScope: StaffShiftBellScope = hasModuleRead(has, "staff")
    ? "team"
    : "own";

  return { access, shiftScope };
}
