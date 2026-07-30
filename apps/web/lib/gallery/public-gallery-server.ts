import "server-only";

import { unstable_cache } from "next/cache";
import {
  GALLERY_FILTER_ALL,
  type GalleryPlatform,
  type GalleryPlatformFilter,
} from "@/lib/constants/gallery-platforms";
import { GALLERY_FEED_PAGE_SIZE } from "@/lib/gallery/gallery-feed-pagination";
import { readGalleryFeedFromCache } from "@/lib/gallery/gallery-feed-read-server";
import { triggerGalleryFeedSyncIfStale } from "@/lib/gallery/gallery-feed-sync-server";
import {
  collectGalleryPlatforms,
  toPublicGalleryHighlight,
  toPublicGalleryItem,
} from "@/lib/gallery/public-gallery-item";
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
  /** Gefilterte Gesamtzahl (für Pagination). */
  totalCount: number;
  availablePlatforms: GalleryPlatform[];
  page: number;
  pageSize: number;
};

export type FetchPublicEmbedGalleryOptions = {
  page?: number;
  pageSize?: number;
  platform?: GalleryPlatformFilter;
  /** Alle Items (schlank) — Embed-SSR; Profil nutzt Pagination. */
  all?: boolean;
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
  options: FetchPublicEmbedGalleryOptions = {},
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
    .select("id, name, slug, brand_accent_hex, is_published")
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
  const availablePlatforms = collectGalleryPlatforms(feed.items);
  const platform = options.platform ?? GALLERY_FILTER_ALL;
  const filtered =
    platform === GALLERY_FILTER_ALL
      ? feed.items
      : feed.items.filter((item) => item.platform === platform);

  const pageSize = Math.min(
    48,
    Math.max(1, options.pageSize ?? GALLERY_FEED_PAGE_SIZE),
  );
  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const page = options.all
    ? 1
    : Math.min(totalPages, Math.max(1, options.page ?? 1));
  const slice = options.all
    ? filtered
    : filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    data: {
      restaurantId,
      name: (row.name as string) ?? "Restaurant",
      slug: (row.slug as string) ?? slug,
      accentHex:
        normalizeHex((row.brand_accent_hex as string | null) ?? "") ??
        DEFAULT_ACCENT_HEX,
      items: slice.map(toPublicGalleryItem),
      highlights: feed.highlights.map(toPublicGalleryHighlight),
      totalCount,
      availablePlatforms,
      page,
      pageSize,
    },
    error: null,
  };
}
