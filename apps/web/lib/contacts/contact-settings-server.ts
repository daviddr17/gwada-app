import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantContactSettings = {
  autoCreateFromReservations: boolean;
  autoCreateFromMessages: boolean;
};

export async function fetchRestaurantContactSettingsAdmin(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantContactSettings> {
  const { data } = await admin
    .from("restaurant_contact_settings")
    .select("auto_create_from_reservations, auto_create_from_messages")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const row = data as {
    auto_create_from_reservations?: boolean | null;
    auto_create_from_messages?: boolean | null;
  } | null;

  return {
    autoCreateFromReservations: row?.auto_create_from_reservations ?? true,
    autoCreateFromMessages: row?.auto_create_from_messages ?? true,
  };
}
