import {
  clearWhatsappPushModules,
  mergeNotificationPreferences,
  notificationPreferencesToRow,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SupabaseClient } from "@supabase/supabase-js";

const SELECT =
  "restaurant_id, channel_whatsapp_enabled, channel_email_enabled, in_app_modules, push_whatsapp_modules, push_email_modules";

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

/** Alle WhatsApp-Push-Toggles für ein Profil aus (z. B. nach Löschen der Telefonnummer). */
export async function clearWhatsappPushPreferencesForProfile(
  client: SupabaseClient,
  profileId: string,
): Promise<{ ok: boolean; error?: string; updated: number }> {
  const { data, error } = await client
    .from("user_restaurant_notification_preferences")
    .select(SELECT)
    .eq("profile_id", profileId);

  if (error) {
    return { ok: false, error: error.message, updated: 0 };
  }

  let updated = 0;
  for (const row of data ?? []) {
    const restaurantId =
      typeof (row as { restaurant_id?: string }).restaurant_id === "string"
        ? (row as { restaurant_id: string }).restaurant_id
        : null;
    if (!restaurantId) continue;

    const prefs = clearWhatsappPushModules(
      mergeNotificationPreferences(row as Record<string, unknown>),
    );
    const result = await upsertNotificationPreferences(client, {
      profileId,
      restaurantId,
      preferences: prefs,
    });
    if (!result.ok) {
      return { ok: false, error: result.error, updated };
    }
    updated += 1;
  }

  return { ok: true, updated };
}
