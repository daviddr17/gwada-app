import {
  mergeNotificationPreferences,
  notificationPreferencesToRow,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SupabaseClient } from "@supabase/supabase-js";

const SELECT =
  "channel_whatsapp_enabled, channel_email_enabled, in_app_modules, push_whatsapp_modules, push_email_modules";

export async function loadNotificationPreferences(
  client: SupabaseClient,
  params: { profileId: string; restaurantId: string },
): Promise<NotificationPreferences> {
  const { data } = await client
    .from("user_restaurant_notification_preferences")
    .select(SELECT)
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  return mergeNotificationPreferences(
    data as Record<string, unknown> | null,
  );
}

export async function loadNotificationPreferencesBrowser(
  profileId: string,
  restaurantId: string,
): Promise<NotificationPreferences> {
  const client = createSupabaseBrowserClient();
  return loadNotificationPreferences(client, { profileId, restaurantId });
}

export async function upsertNotificationPreferences(
  client: SupabaseClient,
  params: {
    profileId: string;
    restaurantId: string;
    preferences: NotificationPreferences;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client
    .from("user_restaurant_notification_preferences")
    .upsert(
      notificationPreferencesToRow(
        params.preferences,
        params.profileId,
        params.restaurantId,
      ),
      { onConflict: "profile_id,restaurant_id" },
    );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
