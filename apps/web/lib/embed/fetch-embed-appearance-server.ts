import "server-only";

import {
  DEFAULT_EMBED_TEXT_THEME,
  parseEmbedTextTheme,
  type EmbedAppearanceWidget,
  type EmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchEmbedTextThemeForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
  widget: EmbedAppearanceWidget,
): Promise<EmbedTextTheme> {
  const { data, error } = await admin
    .from("restaurant_embed_appearance")
    .select("text_theme")
    .eq("restaurant_id", restaurantId)
    .eq("widget", widget)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_EMBED_TEXT_THEME;
  }

  return parseEmbedTextTheme(data.text_theme as string | null);
}

export async function fetchEmbedTextThemeForSlug(
  slugInput: string,
  widget: EmbedAppearanceWidget,
): Promise<EmbedTextTheme> {
  const admin = createSupabaseAdminClient();
  if (!admin) return DEFAULT_EMBED_TEXT_THEME;

  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug) return DEFAULT_EMBED_TEXT_THEME;

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant?.id) {
    return DEFAULT_EMBED_TEXT_THEME;
  }

  return fetchEmbedTextThemeForRestaurant(
    admin,
    restaurant.id as string,
    widget,
  );
}
