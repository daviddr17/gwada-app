import "server-only";

import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchRestaurantTimezoneServer(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string> {
  const { data } = await admin
    .from("restaurants")
    .select("timezone")
    .eq("id", restaurantId)
    .maybeSingle();
  const tz = (data as { timezone?: string } | null)?.timezone?.trim();
  return tz || DEFAULT_RESTAURANT_TIMEZONE;
}
