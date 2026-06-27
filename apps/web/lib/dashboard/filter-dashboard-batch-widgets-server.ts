import "server-only";

import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import { hasDashboardWidgetAccess } from "@/lib/permissions/dashboard-widget-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Batch-Widgets serverseitig auf Modul-Lese-Rechte filtern (wie Sidebar). */
export async function filterDashboardBatchWidgetsForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
  widgets: readonly DashboardBatchWidgetId[],
): Promise<DashboardBatchWidgetId[]> {
  const { data, error } = await sb.rpc("auth_user_restaurant_permission_keys", {
    p_restaurant_id: restaurantId,
  });
  if (error || !data) return [];

  const keySet = new Set(data as RestaurantPermissionKey[]);
  const has = (key: RestaurantPermissionKey) => keySet.has(key);

  return widgets.filter((id) => hasDashboardWidgetAccess(has, id));
}
