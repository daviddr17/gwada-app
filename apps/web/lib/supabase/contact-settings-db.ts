import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type RestaurantContactSettingsRow = {
  restaurant_id: string;
  auto_link_enabled: boolean;
  auto_create_from_reservations: boolean;
  auto_create_from_messages: boolean;
  auto_create_from_reviews: boolean;
};

export async function fetchContactSettings(
  restaurantId: string,
): Promise<{ data: RestaurantContactSettingsRow | null; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: null, error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_contact_settings")
    .select(
      "restaurant_id, auto_link_enabled, auto_create_from_reservations, auto_create_from_messages, auto_create_from_reviews",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return {
      data: {
        restaurant_id: restaurantId,
        auto_link_enabled: true,
        auto_create_from_reservations: true,
        auto_create_from_messages: true,
        auto_create_from_reviews: true,
      },
      error: null,
    };
  }
  return { data: data as RestaurantContactSettingsRow, error: null };
}

export async function upsertContactSettings(params: {
  restaurantId: string;
  autoLinkEnabled: boolean;
  autoCreateFromReservations: boolean;
  autoCreateFromMessages: boolean;
  autoCreateFromReviews: boolean;
}): Promise<{ error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { error: new Error("Ungültige Restaurant-ID.") };
  }
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("restaurant_contact_settings").upsert(
    {
      restaurant_id: params.restaurantId,
      auto_link_enabled: params.autoLinkEnabled,
      auto_create_from_reservations: params.autoCreateFromReservations,
      auto_create_from_messages: params.autoCreateFromMessages,
      auto_create_from_reviews: params.autoCreateFromReviews,
    },
    { onConflict: "restaurant_id" },
  );
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}
