import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type RestaurantReservationSettingsRow = {
  restaurant_id: string;
  default_dwell_minutes: number;
};

export async function fetchReservationSettings(
  restaurantId: string,
): Promise<{ data: RestaurantReservationSettingsRow | null; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) return { data: null, error: null };
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_reservation_settings")
    .select("restaurant_id, default_dwell_minutes")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as RestaurantReservationSettingsRow | null, error: null };
}

export async function upsertReservationSettings(params: {
  restaurantId: string;
  defaultDwellMinutes: number;
}): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("restaurant_reservation_settings").upsert(
    {
      restaurant_id: params.restaurantId,
      default_dwell_minutes: params.defaultDwellMinutes,
    },
    { onConflict: "restaurant_id" },
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
