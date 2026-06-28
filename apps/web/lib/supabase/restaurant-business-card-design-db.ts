import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseBusinessCardDesign,
  type BusinessCardDesign,
} from "@/lib/restaurant/business-card-design";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export async function fetchBusinessCardDesignFromDb(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<BusinessCardDesign | null> {
  if (!isUuidRestaurantId(restaurantId)) return null;

  const { data, error } = await sb
    .from("restaurants")
    .select("business_card_design")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) {
    console.warn("[gwada] fetchBusinessCardDesignFromDb", error.message);
    return null;
  }

  return parseBusinessCardDesign(data?.business_card_design);
}

export async function upsertBusinessCardDesignInDb(
  sb: SupabaseClient,
  restaurantId: string,
  design: BusinessCardDesign,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, error: "invalid_restaurant_id" };
  }

  const { error } = await sb
    .from("restaurants")
    .update({ business_card_design: design })
    .eq("id", restaurantId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
