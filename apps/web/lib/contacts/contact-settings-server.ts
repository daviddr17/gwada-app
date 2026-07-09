import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantContactSettings = {
  autoLinkEnabled: boolean;
  autoCreateFromReservations: boolean;
  autoCreateFromMessages: boolean;
  autoCreateFromReviews: boolean;
};

export async function fetchRestaurantContactSettingsAdmin(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantContactSettings> {
  const { data } = await admin
    .from("restaurant_contact_settings")
    .select(
      "auto_link_enabled, auto_create_from_reservations, auto_create_from_messages, auto_create_from_reviews",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const row = data as {
    auto_link_enabled?: boolean | null;
    auto_create_from_reservations?: boolean | null;
    auto_create_from_messages?: boolean | null;
    auto_create_from_reviews?: boolean | null;
  } | null;

  return {
    autoLinkEnabled: row?.auto_link_enabled ?? true,
    autoCreateFromReservations: row?.auto_create_from_reservations ?? true,
    autoCreateFromMessages: row?.auto_create_from_messages ?? true,
    autoCreateFromReviews: row?.auto_create_from_reviews ?? true,
  };
}
