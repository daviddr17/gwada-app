import { normalizeMenuCurrencyCode } from "@/lib/constants/menu-currencies";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type RestaurantMenuSettingsRow = {
  restaurant_id: string;
  currency_code: string;
};

export async function fetchMenuSettings(
  restaurantId: string,
): Promise<{ data: RestaurantMenuSettingsRow | null; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) return { data: null, error: null };
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_menu_settings")
    .select("restaurant_id, currency_code")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as RestaurantMenuSettingsRow | null, error: null };
}

export async function upsertMenuSettings(params: {
  restaurantId: string;
  currencyCode: string;
}): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("restaurant_menu_settings").upsert({
    restaurant_id: params.restaurantId,
    currency_code: normalizeMenuCurrencyCode(params.currencyCode),
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
