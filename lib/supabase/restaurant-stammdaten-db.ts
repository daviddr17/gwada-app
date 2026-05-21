import { RESTAURANT_STORAGE_KEY } from "@/lib/constants/restaurant-profile";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { RestaurantProfile } from "@/lib/types/restaurant";
import type { SupabaseClient } from "@supabase/supabase-js";

/** JSON-Pfad in `restaurant_app_state` unter `gwada-restaurant-profile-v1`. */
export const RESTAURANT_PROFILE_STORAGE_KEY = RESTAURANT_STORAGE_KEY;

export function restaurantRowFromProfile(
  profile: RestaurantProfile,
): Record<string, string | null> {
  return {
    name: profile.name.trim() || "Restaurant",
    address_line1: profile.street.trim() || null,
    postal_code: profile.postalCode.trim() || null,
    city: profile.city.trim() || null,
    country: profile.country.trim() || null,
    phone: profile.phone.trim() || null,
  };
}

/** Stammdaten aus dem App-Profil in `public.restaurants` spiegeln (Superadmin, Workspace-Liste). */
export async function syncRestaurantStammdatenToDb(
  sb: SupabaseClient,
  profile: RestaurantProfile,
): Promise<{ ok: boolean; error: string | null }> {
  if (!isUuidRestaurantId(profile.id)) {
    return { ok: true, error: null };
  }

  const { error } = await sb
    .from("restaurants")
    .update(restaurantRowFromProfile(profile))
    .eq("id", profile.id);

  return { ok: !error, error: error?.message ?? null };
}
