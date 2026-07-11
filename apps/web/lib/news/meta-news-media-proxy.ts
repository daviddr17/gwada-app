import type { NewsPlatform } from "@/lib/constants/news-platforms";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import type { UnifiedNewsStorySlide } from "@/lib/news/unified-news-story";

export type MetaNewsMediaAudience = "app" | "public";

export type MetaNewsMediaPlatform = Extract<NewsPlatform, "facebook" | "instagram">;

const APP_META_NEWS_MEDIA_PROXY_PATH = "/api/contact-messages/meta/media";
const PUBLIC_META_NEWS_MEDIA_PROXY_PATH = "/api/public/news/media";

const META_NEWS_MEDIA_PROXY_PATHS = [
  APP_META_NEWS_MEDIA_PROXY_PATH,
  PUBLIC_META_NEWS_MEDIA_PROXY_PATH,
] as const;

function metaNewsMediaProxyPath(audience: MetaNewsMediaAudience): string {
  return audience === "public"
    ? PUBLIC_META_NEWS_MEDIA_PROXY_PATH
    : APP_META_NEWS_MEDIA_PROXY_PATH;
}

function isMetaNewsMediaProxyPath(pathname: string): boolean {
  return META_NEWS_MEDIA_PROXY_PATHS.some((prefix) => pathname.startsWith(prefix));
}

export function extractMetaMediaUrlFromProxy(url: string): string | null {
  try {
    const parsed = new URL(url, "http://local");
    if (!isMetaNewsMediaProxyPath(parsed.pathname)) return null;
    return parsed.searchParams.get("url");
  } catch {
    return null;
  }
}

export function isMetaHostedMediaUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname.endsWith("fbcdn.net") ||
      hostname.endsWith("facebook.com") ||
      hostname.endsWith("instagram.com")
    );
  } catch {
    return false;
  }
}

export function unwrapMetaNewsMediaUrl(url: string): string {
  return extractMetaMediaUrlFromProxy(url) ?? url;
}

export function proxyMetaNewsMediaUrl(
  restaurantId: string,
  platform: MetaNewsMediaPlatform,
  rawUrl: string,
  audience: MetaNewsMediaAudience,
): string {
  const url = unwrapMetaNewsMediaUrl(rawUrl.trim());
  const q = new URLSearchParams({
    restaurantId,
    platform,
    url,
  });
  return `${metaNewsMediaProxyPath(audience)}?${q}`;
}

export function resolveMetaNewsMediaUrlForAudience(
  restaurantId: string,
  platform: MetaNewsMediaPlatform,
  url: string | null | undefined,
  audience: MetaNewsMediaAudience,
): string | null {
  if (!url?.trim()) return null;

  const unwrapped = unwrapMetaNewsMediaUrl(url);
  if (
    !isMetaHostedMediaUrl(unwrapped) &&
    extractMetaMediaUrlFromProxy(url) == null
  ) {
    return url;
  }

  return proxyMetaNewsMediaUrl(restaurantId, platform, unwrapped, audience);
}

export function resolveNewsItemMetaMediaUrls(
  restaurantId: string,
  item: UnifiedNewsItem,
  audience: MetaNewsMediaAudience,
): UnifiedNewsItem {
  if (item.platform !== "instagram" && item.platform !== "facebook") {
    return item;
  }
  if (item.media.length === 0) return item;

  let changed = false;
  const media = item.media.map((entry) => {
    const url = resolveMetaNewsMediaUrlForAudience(
      restaurantId,
      item.platform as MetaNewsMediaPlatform,
      entry.url,
      audience,
    );
    const thumbUrl = entry.thumbUrl
      ? resolveMetaNewsMediaUrlForAudience(
          restaurantId,
          item.platform as MetaNewsMediaPlatform,
          entry.thumbUrl,
          audience,
        )
      : entry.thumbUrl;
    if (url === entry.url && thumbUrl === entry.thumbUrl) return entry;
    changed = true;
    return { ...entry, url, thumbUrl };
  });

  return changed ? { ...item, media } : item;
}

export function resolveNewsFeedMetaMediaUrls(
  restaurantId: string,
  items: UnifiedNewsItem[],
  audience: MetaNewsMediaAudience,
): UnifiedNewsItem[] {
  return items.map((item) =>
    resolveNewsItemMetaMediaUrls(restaurantId, item, audience),
  );
}

export function resolveStorySlideMetaMediaUrl(
  restaurantId: string,
  slide: UnifiedNewsStorySlide,
  audience: MetaNewsMediaAudience,
): UnifiedNewsStorySlide {
  if (slide.platform !== "instagram" && slide.platform !== "facebook") {
    return slide;
  }
  const resolved = resolveMetaNewsMediaUrlForAudience(
    restaurantId,
    slide.platform,
    slide.url,
    audience,
  );
  if (!resolved || resolved === slide.url) return slide;
  return { ...slide, url: resolved };
}

export function resolveNewsStoriesMetaMediaUrls(
  restaurantId: string,
  slides: UnifiedNewsStorySlide[],
  audience: MetaNewsMediaAudience,
): UnifiedNewsStorySlide[] {
  return slides.map((slide) =>
    resolveStorySlideMetaMediaUrl(restaurantId, slide, audience),
  );
}
