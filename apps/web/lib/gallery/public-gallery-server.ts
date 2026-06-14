import "server-only";

import { unstable_cache } from "next/cache";
import { readGalleryFeedFromCache } from "@/lib/gallery/gallery-feed-read-server";
import { triggerGalleryFeedSyncIfStale } from "@/lib/gallery/gallery-feed-sync-server";
import type { UnifiedGalleryHighlight, UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicEmbedGallery = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
  items: UnifiedGalleryItem[];
  highlights: UnifiedGalleryHighlight[];
};

function adminOrError():
  | SupabaseClient
  | { error: string; status: number } {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured", status: 503 };
  return admin;
}

async function loadGalleryFeedBaseUncached(restaurantId: string): Promise<{
  items: UnifiedGalleryItem[];
  highlights: UnifiedGalleryHighlight[];
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { items: [], highlights: [] };
  }

  void triggerGalleryFeedSyncIfStale(restaurantId);
  const feed = await readGalleryFeedFromCache(restaurantId, admin);
  return { items: feed.items, highlights: feed.highlights };
}

const loadGalleryFeedBase = (restaurantId: string) =>
  unstable_cache(
    async () => loadGalleryFeedBaseUncached(restaurantId),
    ["public-embed-gallery-feed", restaurantId],
    { revalidate: 60 },
  )();

export async function fetchPublicEmbedGallery(
  slugInput: string,
): Promise<
  | { data: PublicEmbedGallery; error: null }
  | { data: null; error: string; status: number }
> {
  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug) {
    return { data: null, error: "invalid_slug", status: 400 };
  }

  const { data: row, error } = await admin
    .from("restaurants")
    .select("id, name, slug, accent_color, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { data: null, error: "db_error", status: 500 };
  }
  if (!row?.id || !row.is_published) {
    return { data: null, error: "not_found", status: 404 };
  }

  const restaurantId = row.id as string;
  const feed = await loadGalleryFeedBase(restaurantId);

  return {
    data: {
      restaurantId,
      name: (row.name as string) ?? "Restaurant",
      slug: (row.slug as string) ?? slug,
      accentHex:
        normalizeHex((row.accent_color as string) ?? DEFAULT_ACCENT_HEX) ??
        DEFAULT_ACCENT_HEX,
      items: feed.items,
      highlights: feed.highlights,
    },
    error: null,
  };
}
