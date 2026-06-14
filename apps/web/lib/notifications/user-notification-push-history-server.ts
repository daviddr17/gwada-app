import "server-only";

import {
  mapUserNotificationPushHistoryRows,
  type UserNotificationPushHistoryResult,
} from "@/lib/notifications/user-notification-push-history";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchUserNotificationPushHistory(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    limit?: number;
    offset?: number;
  },
): Promise<UserNotificationPushHistoryResult & { error: string | null }> {
  const { data, error } = await sb.rpc("user_list_notification_push_history", {
    p_context_restaurant_id: params.restaurantId,
    p_limit: params.limit ?? 5,
    p_offset: params.offset ?? 0,
  });

  if (error) {
    return { rows: [], totalCount: 0, error: error.message };
  }

  const mapped = mapUserNotificationPushHistoryRows(
    (data ?? []) as Parameters<typeof mapUserNotificationPushHistoryRows>[0],
  );
  return { ...mapped, error: null };
}
