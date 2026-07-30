import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultSocialBrandKit,
  parseSocialBrandKit,
  socialBrandKitForPersistence,
  type SocialBrandKit,
} from "@/lib/social/social-brand-kit";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function fetchSocialBrandKitFromDb(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<SocialBrandKit> {
  if (!isUuidRestaurantId(restaurantId)) {
    return defaultSocialBrandKit(restaurantId);
  }

  const { data, error } = await sb
    .from("restaurant_social_brand_kit")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    console.warn("[gwada] fetchSocialBrandKitFromDb", error.message);
    return defaultSocialBrandKit(restaurantId);
  }

  if (!data) return defaultSocialBrandKit(restaurantId);
  return parseSocialBrandKit(restaurantId, data);
}

export async function upsertSocialBrandKitInDb(
  sb: SupabaseClient,
  kit: SocialBrandKit,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuidRestaurantId(kit.restaurantId)) {
    return { ok: false, error: "invalid_restaurant_id" };
  }

  const row = socialBrandKitForPersistence(kit);
  const { error } = await sb
    .from("restaurant_social_brand_kit")
    .upsert(row, { onConflict: "restaurant_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
