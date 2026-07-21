import {
  NEWS_PLATFORM_LABELS,
  NEWS_PLATFORMS,
  isNewsPlatform,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";

/** Standard: alle News-Kanäle inkl. Gwada-Feed. */
export const SOCIAL_DEFAULT_PUBLISH_PLATFORMS: readonly NewsPlatform[] = [
  "gwada",
  "facebook",
  "instagram",
  "google_business",
  "whatsapp_channel",
] as const;

export function parseSocialPublishPlatforms(raw: unknown): NewsPlatform[] {
  if (!Array.isArray(raw)) {
    return [...SOCIAL_DEFAULT_PUBLISH_PLATFORMS];
  }
  const out: NewsPlatform[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (!isNewsPlatform(item)) continue;
    if (out.includes(item)) continue;
    out.push(item);
  }
  return out.length ? out : [...SOCIAL_DEFAULT_PUBLISH_PLATFORMS];
}

export function socialPublishPlatformLabel(platform: NewsPlatform): string {
  return NEWS_PLATFORM_LABELS[platform];
}

export function allSocialPublishPlatformOptions(): Array<{
  value: NewsPlatform;
  label: string;
}> {
  return NEWS_PLATFORMS.map((value) => ({
    value,
    label: NEWS_PLATFORM_LABELS[value],
  }));
}

/** Caption leicht für Google kürzen (Local Posts Summary-Limit). */
export function captionForMultiPlatformPublish(caption: string): string {
  const trimmed = caption.trim();
  if (trimmed.length <= 1400) return trimmed;
  return `${trimmed.slice(0, 1390).trim()}…`;
}
