import "server-only";

import { unstable_cache } from "next/cache";
import { readGalleryFeedFromCache } from "@/lib/gallery/gallery-feed-read-server";
import { triggerGalleryFeedSyncIfStale } from "@/lib/gallery/gallery-feed-sync-server";
import type { UnifiedGalleryHighlight, UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicEmbedGallery = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
  items: UnifiedGalleryItem[];
  highlights: UnifiedGalleryHighlight[];
};

async function loadPublicGallery(slug: string): Promise<PublicEmbedGallery | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const normalized = normalizeRestaurantSlugInput(slug);
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, slug, accent_color")
    .eq("slug", normalized)
    .maybeSingle();

  if (!restaurant?.id) return null;

  const sb = admin;
  void triggerGalleryFeedSyncIfStale(restaurant.id as string);

  const feed = await readGalleryFeedFromCache(restaurant.id as string, sb);

  return {
    restaurantId: restaurant.id as string,
    name: (restaurant.name as string) ?? "Restaurant",
    slug: (restaurant.slug as string) ?? normalized,
    accentHex: normalizeHex((restaurant.accent_color as string) ?? DEFAULT_ACCENT_HEX) ?? DEFAULT_ACCENT_HEX,
    items: feed.items,
    highlights: feed.highlights,
  };
}

export async function fetchPublicEmbedGallery(
  slug: string,
): Promise<PublicEmbedGallery | null> {
  const normalized = normalizeRestaurantSlugInput(slug);
  return unstable_cache(
    () => loadPublicGallery(normalized),
    ["public-embed-gallery", normalized],
    { revalidate: 120 },
  )();
}
