export type FeedPinModule = "news" | "events" | "gallery" | "reviews";

export const FEED_PIN_MODULES = [
  "news",
  "events",
  "gallery",
  "reviews",
] as const satisfies readonly FeedPinModule[];

export function isFeedPinModule(value: string): value is FeedPinModule {
  return (FEED_PIN_MODULES as readonly string[]).includes(value);
}

type FeedPinModuleTables = {
  gwadaTable: string;
  cacheTable: string;
};

export const FEED_PIN_MODULE_TABLES: Record<FeedPinModule, FeedPinModuleTables> = {
  news: {
    gwadaTable: "gwada_news_posts",
    cacheTable: "restaurant_news_platform_cache",
  },
  events: {
    gwadaTable: "gwada_events",
    cacheTable: "restaurant_events_platform_cache",
  },
  gallery: {
    gwadaTable: "gwada_gallery_items",
    cacheTable: "restaurant_gallery_platform_cache",
  },
  reviews: {
    gwadaTable: "gwada_reviews",
    cacheTable: "restaurant_reviews_platform_cache",
  },
};

export type FeedPinTarget =
  | { source: "gwada"; rowId: string }
  | { source: "external"; platform: string; externalId: string };

/** Einheitliche Item-Referenz aus Feed-Item (Dashboard / API). */
export function feedPinTargetFromItem(params: {
  platform: string;
  itemId: string;
}): FeedPinTarget {
  if (params.platform === "gwada") {
    const prefix = "gwada:";
    const rowId = params.itemId.startsWith(prefix)
      ? params.itemId.slice(prefix.length)
      : params.itemId;
    return { source: "gwada", rowId };
  }

  const prefix = `${params.platform}:`;
  const externalId = params.itemId.startsWith(prefix)
    ? params.itemId.slice(prefix.length)
    : params.itemId;

  return { source: "external", platform: params.platform, externalId };
}

export function compareFeedItemsWithPinFirst<T extends { isPinned?: boolean }>(
  a: T,
  b: T,
  thenCompare: (left: T, right: T) => number,
): number {
  const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
  if (pinDiff !== 0) return pinDiff;
  return thenCompare(a, b);
}

export function withFeedPinFlag<T extends { isPinned?: boolean }>(
  item: T,
  isPinned: boolean,
): T {
  return isPinned ? { ...item, isPinned: true } : { ...item, isPinned: false };
}
