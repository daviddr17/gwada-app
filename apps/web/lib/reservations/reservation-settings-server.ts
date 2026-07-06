import type { SupabaseClient } from "@supabase/supabase-js";

/** Legt eine Zeile mit DB-Defaults an, falls noch keine existiert (Service-Role / Admin). */
export async function ensureRestaurantReservationSettings(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  const { error } = await sb.from("restaurant_reservation_settings").upsert(
    { restaurant_id: restaurantId },
    { onConflict: "restaurant_id", ignoreDuplicates: true },
  );
  if (error) {
    console.warn("[gwada] ensureRestaurantReservationSettings", error.message);
  }
}
