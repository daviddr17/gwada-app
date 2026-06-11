import type { NewsPlatform } from "@/lib/constants/news-platforms";

/** Externe Plattformen, deren Feed in der DB gecacht wird (Gwada bleibt in gwada_news_posts). */
export const NEWS_CACHEABLE_PLATFORMS = [
  "facebook",
  "instagram",
  "google_business",
  "whatsapp_channel",
] as const satisfies readonly NewsPlatform[];

export type NewsCacheablePlatform = (typeof NEWS_CACHEABLE_PLATFORMS)[number];

export const NEWS_CACHE_STALE_MS = 10 * 60 * 1000;

export function isNewsCacheablePlatform(
  platform: NewsPlatform,
): platform is NewsCacheablePlatform {
  return (NEWS_CACHEABLE_PLATFORMS as readonly string[]).includes(platform);
}
