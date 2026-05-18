import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { normalizeHex } from "@/lib/theme/color-utils";

export async function fetchRestaurantBrandAccentHex(
  restaurantId: string,
): Promise<string | null> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurants")
    .select("brand_accent_hex")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = data.brand_accent_hex;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return normalizeHex(raw);
}

export async function updateRestaurantBrandAccentHex(
  restaurantId: string,
  hex: string,
): Promise<boolean> {
  const normalized = normalizeHex(hex);
  if (!normalized) return false;
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("restaurants")
    .update({ brand_accent_hex: normalized })
    .eq("id", restaurantId);
  if (error) {
    console.warn("[gwada] updateRestaurantBrandAccentHex", error.message);
    return false;
  }
  return true;
}
