import "server-only";

import { unstable_cache } from "next/cache";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { getNewsConnectorPublicInfo } from "@/lib/news/connectors/registry";
import { readNewsFeedFromCache } from "@/lib/news/news-feed-read-server";
import { triggerNewsFeedSyncIfStale } from "@/lib/news/news-feed-sync-server";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicEmbedNews = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
  viewMode: "grid" | "list";
  connectedPlatforms: NewsPlatform[];
  items: UnifiedNewsItem[];
};

function adminOrError():
  | SupabaseClient
  | { error: string; status: number } {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured", status: 503 };
  return admin;
}

async function loadPublicNewsUncached(
  restaurantId: string,
): Promise<{
  items: UnifiedNewsItem[];
  connectedPlatforms: NewsPlatform[];
  viewMode: "grid" | "list";
  maxItems: number;
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      items: [],
      connectedPlatforms: ["gwada"],
      viewMode: "grid",
      maxItems: 24,
    };
  }

  const { data: settingsRow } = await admin
    .from("restaurant_news_settings")
    .select("default_embed_view, embed_max_items")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const viewMode =
    settingsRow?.default_embed_view === "list" ? "list" : "grid";
  const maxItems = Math.min(
    100,
    Math.max(1, Number(settingsRow?.embed_max_items ?? 24)),
  );

  const { items: feedItems } = await readNewsFeedFromCache(restaurantId, admin);
  void triggerNewsFeedSyncIfStale(restaurantId);

  const items = feedItems
    .filter((item) => item.status === "published")
    .slice(0, maxItems);

  const connectorInfo = await getNewsConnectorPublicInfo(restaurantId);
  const connectedPlatforms = connectorInfo
    .filter((c) => c.connected && c.capabilities.canReadFeed)
    .map((c) => c.key) as NewsPlatform[];

  return { items, connectedPlatforms, viewMode, maxItems };
}

const loadPublicNews = (restaurantId: string) =>
  unstable_cache(
    async () => loadPublicNewsUncached(restaurantId),
    ["public-embed-news", restaurantId],
    { revalidate: 60 },
  )();

export async function fetchPublicEmbedNews(
  slugInput: string,
): Promise<
  | { data: PublicEmbedNews; error: null }
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
  const { items, connectedPlatforms, viewMode } = await loadPublicNews(restaurantId);

  return {
    data: {
      restaurantId,
      name: row.name as string,
      slug: row.slug as string,
      accentHex:
        normalizeHex((row.brand_accent_hex as string | null) ?? "") ??
        DEFAULT_ACCENT_HEX,
      viewMode,
      connectedPlatforms,
      items,
    },
    error: null,
  };
}
