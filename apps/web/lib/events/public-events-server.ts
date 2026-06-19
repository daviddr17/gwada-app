import "server-only";

import { unstable_cache } from "next/cache";
import {
  EVENTS_FILTER_ALL,
  isEventsPlatform,
  type EventsPlatform,
  type EventsPlatformFilter,
} from "@/lib/constants/events-platforms";
import {
  clampListPage,
  parseListPageParam,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import { getEventsConnectorPublicInfo } from "@/lib/events/connectors/registry";
import {
  filterItemsForEventsEmbed,
  filterPlatformsForEventsEmbed,
  normalizeEventsEmbedPlatforms,
} from "@/lib/events/events-embed-platforms";
import { EVENTS_FEED_PAGE_SIZE } from "@/lib/events/events-feed-pagination";
import { readEventsFeedFromCache } from "@/lib/events/events-feed-read-server";
import { triggerEventsFeedSyncIfStale } from "@/lib/events/events-feed-sync-server";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicEmbedEvents = {
  restaurantId: string;
  name: string;
  slug: string;
  accentHex: string;
  viewMode: "grid" | "list";
  connectedPlatforms: EventsPlatform[];
  items: UnifiedEventItem[];
  showAllPlatformFilter: boolean;
};

async function loadPublicEmbedEventsUncached(
  slug: string,
): Promise<
  | { data: PublicEmbedEvents; error?: undefined; status?: undefined }
  | { data?: undefined; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_config", status: 500 };

  const { data: restaurant, error } = await admin
    .from("restaurants")
    .select("id, name, slug, is_published, brand_accent_hex")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !restaurant?.id) return { error: "not_found", status: 404 };
  if (!restaurant.is_published) return { error: "not_found", status: 404 };

  const restaurantId = restaurant.id as string;

  const [{ data: settings }, connectors, feed] = await Promise.all([
    admin
      .from("restaurant_events_settings")
      .select("default_embed_view, embed_max_items, embed_platforms, embed_show_all_filter")
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    getEventsConnectorPublicInfo(restaurantId),
    readEventsFeedFromCache(restaurantId, admin),
  ]);

  void triggerEventsFeedSyncIfStale(restaurantId);

  const embedPlatforms = normalizeEventsEmbedPlatforms(settings?.embed_platforms);
  const connectedFromConnectors = connectors
    .filter((c) => c.key === "gwada" || (c.connected && c.capabilities.canReadFeed))
    .map((c) => c.key);

  const connectedPlatforms = filterPlatformsForEventsEmbed(
    connectedFromConnectors,
    embedPlatforms,
  );

  const now = Date.now();
  const upcoming = feed.items.filter((item) => new Date(item.startAt).getTime() >= now - 24 * 60 * 60 * 1000);
  const maxItems = Number(settings?.embed_max_items ?? 24);
  const filtered = filterItemsForEventsEmbed(upcoming, embedPlatforms).slice(0, maxItems);

  return {
    data: {
      restaurantId,
      name: (restaurant.name as string) ?? "",
      slug,
      accentHex: (() => {
        const raw = restaurant.brand_accent_hex as string | null;
        return (raw ? normalizeHex(raw) : null) ?? DEFAULT_ACCENT_HEX;
      })(),
      viewMode: settings?.default_embed_view === "grid" ? "grid" : "list",
      connectedPlatforms,
      items: filtered,
      showAllPlatformFilter: settings?.embed_show_all_filter !== false,
    },
  };
}

const cachedLoad = unstable_cache(
  async (slug: string) => loadPublicEmbedEventsUncached(slug),
  ["public-embed-events"],
  { revalidate: 60 },
);

export async function fetchPublicEmbedEvents(slugInput: string) {
  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug) return { error: "not_found" as const, status: 404 };
  return cachedLoad(slug);
}

export function parseEventsEmbedPlatformFilter(
  raw: string | null | undefined,
): EventsPlatformFilter {
  if (!raw || raw === EVENTS_FILTER_ALL) return EVENTS_FILTER_ALL;
  if (isEventsPlatform(raw)) return raw;
  return EVENTS_FILTER_ALL;
}

export function paginateEmbedEventsItems(
  allItems: UnifiedEventItem[],
  connectedPlatforms: EventsPlatform[],
  options: { page?: number; platform?: EventsPlatformFilter },
): { items: UnifiedEventItem[]; totalCount: number; totalPages: number; page: number } {
  const platformFilter =
    options.platform && options.platform !== EVENTS_FILTER_ALL && connectedPlatforms.includes(options.platform)
      ? options.platform
      : EVENTS_FILTER_ALL;
  const filtered =
    platformFilter === EVENTS_FILTER_ALL
      ? allItems
      : allItems.filter((item) => item.platform === platformFilter);
  const totalCount = filtered.length;
  const totalPages = totalPagesFromCount(totalCount, EVENTS_FEED_PAGE_SIZE);
  const page = clampListPage(parseListPageParam(options.page != null ? String(options.page) : undefined), totalPages);
  const from = (page - 1) * EVENTS_FEED_PAGE_SIZE;
  return {
    items: filtered.slice(from, from + EVENTS_FEED_PAGE_SIZE),
    totalCount,
    totalPages,
    page,
  };
}
