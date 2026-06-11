import {
  NEWS_PLATFORMS,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";

export type NewsEmbedPlatforms = Record<NewsPlatform, boolean>;

export function defaultEmbedPlatforms(): NewsEmbedPlatforms {
  return Object.fromEntries(
    NEWS_PLATFORMS.map((platform) => [platform, true]),
  ) as NewsEmbedPlatforms;
}

export function normalizeEmbedPlatforms(raw: unknown): NewsEmbedPlatforms {
  const result = defaultEmbedPlatforms();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return result;
  }
  const record = raw as Record<string, unknown>;
  for (const platform of NEWS_PLATFORMS) {
    const value = record[platform];
    if (typeof value === "boolean") {
      result[platform] = value;
    }
  }
  return result;
}

export function isEmbedPlatformEnabled(
  platforms: NewsEmbedPlatforms,
  platform: NewsPlatform,
): boolean {
  return platforms[platform] !== false;
}

export function enabledEmbedPlatforms(
  platforms: NewsEmbedPlatforms,
): NewsPlatform[] {
  return NEWS_PLATFORMS.filter((platform) =>
    isEmbedPlatformEnabled(platforms, platform),
  );
}

export function filterPlatformsForEmbed(
  connectedPlatforms: NewsPlatform[],
  embedPlatforms: NewsEmbedPlatforms,
): NewsPlatform[] {
  return connectedPlatforms.filter((platform) =>
    isEmbedPlatformEnabled(embedPlatforms, platform),
  );
}

export function filterItemsForEmbed<T extends { platform: NewsPlatform }>(
  items: T[],
  embedPlatforms: NewsEmbedPlatforms,
): T[] {
  return items.filter((item) =>
    isEmbedPlatformEnabled(embedPlatforms, item.platform),
  );
}
