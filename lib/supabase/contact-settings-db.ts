import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type RestaurantContactSettingsRow = {
  restaurant_id: string;
  auto_create_from_reservations: boolean;
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
    .select("restaurant_id, auto_create_from_reservations")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return {
      data: {
        restaurant_id: restaurantId,
        auto_create_from_reservations: true,
      },
      error: null,
    };
  }
  return { data: data as RestaurantContactSettingsRow, error: null };
}

export async function upsertContactSettings(params: {
  restaurantId: string;
  autoCreateFromReservations: boolean;
}): Promise<{ error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { error: new Error("Ungültige Restaurant-ID.") };
  }
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("restaurant_contact_settings").upsert(
    {
      restaurant_id: params.restaurantId,
      auto_create_from_reservations: params.autoCreateFromReservations,
    },
    { onConflict: "restaurant_id" },
  );
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}
