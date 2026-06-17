import "server-only";

import { unstable_cache } from "next/cache";
import {
  isNewsPlatform,
  NEWS_FILTER_ALL,
  type NewsPlatform,
  type NewsPlatformFilter,
} from "@/lib/constants/news-platforms";
import {
  clampListPage,
  parseListPageParam,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { NEWS_FEED_PAGE_SIZE } from "@/lib/news/news-feed-pagination";
import { getNewsConnectorPublicInfo } from "@/lib/news/connectors/registry";
import {
  filterItemsForEmbed,
  filterPlatformsForEmbed,
  normalizeEmbedPlatforms,
} from "@/lib/news/news-embed-platforms";
import { sortNewsItemsByDate } from "@/lib/news/format-news-display-date";
import { readNewsFeedFromCache } from "@/lib/news/news-feed-read-server";
import { triggerNewsFeedSyncIfStale } from "@/lib/news/news-feed-sync-server";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicEmbedNewsPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  platformFilter: NewsPlatformFilter;
};

export type PublicEmbedNews = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
  viewMode: "grid" | "list";
  connectedPlatforms: NewsPlatform[];
  items: UnifiedNewsItem[];
  /** Chip „Alle“ in Profil & Einbindung — Standard: an. */
  showAllPlatformFilter: boolean;
  /** Gesetzt bei paginiertem Embed (`paginate: true`). */
  pagination?: PublicEmbedNewsPagination;
};

export type FetchPublicEmbedNewsOptions = {
  /** Embed-Route: nur eine Seite laden (schneller für iframes). */
  paginate?: boolean;
  page?: number;
  platform?: NewsPlatformFilter;
};

export function parseNewsEmbedPlatformFilter(
  raw: string | null | undefined,
): NewsPlatformFilter {
  if (!raw || raw === NEWS_FILTER_ALL) return NEWS_FILTER_ALL;
  if (isNewsPlatform(raw)) return raw;
  return NEWS_FILTER_ALL;
}

function resolveEmbedPlatformFilter(
  requested: NewsPlatformFilter,
  connectedPlatforms: NewsPlatform[],
): NewsPlatformFilter {
  if (requested === NEWS_FILTER_ALL) return NEWS_FILTER_ALL;
  return connectedPlatforms.includes(requested) ? requested : NEWS_FILTER_ALL;
}

function paginateEmbedNewsItems(
  allItems: UnifiedNewsItem[],
  connectedPlatforms: NewsPlatform[],
  options: Pick<FetchPublicEmbedNewsOptions, "paginate" | "page" | "platform">,
): { items: UnifiedNewsItem[]; pagination: PublicEmbedNewsPagination } {
  const platformFilter = resolveEmbedPlatformFilter(
    options.platform ?? NEWS_FILTER_ALL,
    connectedPlatforms,
  );
  const filtered =
    platformFilter === NEWS_FILTER_ALL
      ? allItems
      : allItems.filter((item) => item.platform === platformFilter);
  const totalCount = filtered.length;

  if (!options.paginate) {
    return {
      items: filtered,
      pagination: {
        page: 1,
        pageSize: Math.max(totalCount, 1),
        totalCount,
        totalPages: 1,
        platformFilter,
      },
    };
  }

  const pageSize = NEWS_FEED_PAGE_SIZE;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  const page = clampListPage(
    parseListPageParam(
      options.page != null ? String(options.page) : undefined,
    ),
    totalPages,
  );
  const from = (page - 1) * pageSize;
  return {
    items: filtered.slice(from, from + pageSize),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      platformFilter,
    },
  };
}

function adminOrError():
  | SupabaseClient
  | { error: string; status: number } {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured", status: 503 };
  return admin;
}

type NewsEmbedSettings = {
  viewMode: "grid" | "list";
  maxItems: number;
  embedPlatforms: ReturnType<typeof normalizeEmbedPlatforms>;
  showAllPlatformFilter: boolean;
};

async function loadNewsEmbedSettings(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<NewsEmbedSettings> {
  const { data: settingsRow } = await admin
    .from("restaurant_news_settings")
    .select(
      "default_embed_view, embed_max_items, embed_platforms, embed_show_all_filter",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  return {
    viewMode:
      settingsRow?.default_embed_view === "list" ? "list" : "grid",
    maxItems: Math.min(
      100,
      Math.max(1, Number(settingsRow?.embed_max_items ?? 24)),
    ),
    embedPlatforms: normalizeEmbedPlatforms(settingsRow?.embed_platforms),
    showAllPlatformFilter: settingsRow?.embed_show_all_filter !== false,
  };
}

async function loadNewsFeedBaseUncached(restaurantId: string): Promise<{
  publishedItems: UnifiedNewsItem[];
  connectedPlatforms: NewsPlatform[];
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      publishedItems: [],
      connectedPlatforms: ["gwada"],
    };
  }

  const { items: feedItems } = await readNewsFeedFromCache(restaurantId, admin);
  void triggerNewsFeedSyncIfStale(restaurantId);

  const connectorInfo = await getNewsConnectorPublicInfo(restaurantId);
  const connectedPlatforms = connectorInfo
    .filter((c) => c.connected && c.capabilities.canReadFeed)
    .map((c) => c.key) as NewsPlatform[];

  const publishedItems = sortNewsItemsByDate(
    feedItems.filter((item) => item.status === "published"),
  );

  return { publishedItems, connectedPlatforms };
}

const loadNewsFeedBase = (restaurantId: string) =>
  unstable_cache(
    async () => loadNewsFeedBaseUncached(restaurantId),
    ["public-embed-news-feed", restaurantId],
    { revalidate: 60 },
  )();

function applyEmbedSettingsToFeed(
  base: Awaited<ReturnType<typeof loadNewsFeedBaseUncached>>,
  embedSettings: NewsEmbedSettings,
): {
  allItems: UnifiedNewsItem[];
  connectedPlatforms: NewsPlatform[];
  viewMode: "grid" | "list";
  showAllPlatformFilter: boolean;
} {
  const connectedPlatforms = filterPlatformsForEmbed(
    base.connectedPlatforms,
    embedSettings.embedPlatforms,
  );
  const allItems = sortNewsItemsByDate(
    filterItemsForEmbed(base.publishedItems, embedSettings.embedPlatforms),
  ).slice(0, embedSettings.maxItems);

  return {
    allItems,
    connectedPlatforms,
    viewMode: embedSettings.viewMode,
    showAllPlatformFilter: embedSettings.showAllPlatformFilter,
  };
}

async function loadPublicEmbedNewsPayload(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{
  allItems: UnifiedNewsItem[];
  connectedPlatforms: NewsPlatform[];
  viewMode: "grid" | "list";
  showAllPlatformFilter: boolean;
}> {
  const [base, embedSettings] = await Promise.all([
    loadNewsFeedBase(restaurantId),
    loadNewsEmbedSettings(admin, restaurantId),
  ]);
  return applyEmbedSettingsToFeed(base, embedSettings);
}

export async function fetchPublicEmbedNews(
  slugInput: string,
  options: FetchPublicEmbedNewsOptions = {},
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
  const { allItems, connectedPlatforms, viewMode, showAllPlatformFilter } =
    await loadPublicEmbedNewsPayload(admin, restaurantId);
  const { items, pagination } = paginateEmbedNewsItems(
    allItems,
    connectedPlatforms,
    options,
  );

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
      showAllPlatformFilter,
      ...(options.paginate ? { pagination } : {}),
    },
    error: null,
  };
}
