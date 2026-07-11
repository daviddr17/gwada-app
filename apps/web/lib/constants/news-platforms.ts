export const NEWS_PLATFORMS = [
  "gwada",
  "facebook",
  "instagram",
  "google_business",
  "whatsapp_channel",
] as const;

export type NewsPlatform = (typeof NEWS_PLATFORMS)[number];

export const NEWS_PLATFORM_LABELS: Record<NewsPlatform, string> = {
  gwada: "Gwada",
  facebook: "Facebook",
  instagram: "Instagram",
  google_business: "Google",
  whatsapp_channel: "WhatsApp Kanal",
};

export const NEWS_PLATFORM_ORDER: readonly NewsPlatform[] = NEWS_PLATFORMS;

export function isNewsPlatform(value: string): value is NewsPlatform {
  return (NEWS_PLATFORMS as readonly string[]).includes(value);
}

export const NEWS_FILTER_ALL = "all" as const;

export type NewsPlatformFilter = typeof NEWS_FILTER_ALL | NewsPlatform;

export const NEWS_FILTER_LABELS: Record<NewsPlatformFilter, string> = {
  all: "Alle",
  ...NEWS_PLATFORM_LABELS,
};

export function isNewsPlatformFilter(
  value: string,
): value is NewsPlatformFilter {
  return value === NEWS_FILTER_ALL || isNewsPlatform(value);
}

export function parseNewsPlatformFilter(
  platformParam: string | null,
): NewsPlatformFilter {
  if (!platformParam || platformParam === NEWS_FILTER_ALL) {
    return NEWS_FILTER_ALL;
  }
  if (isNewsPlatform(platformParam)) {
    return platformParam;
  }
  return NEWS_FILTER_ALL;
}

export type NewsViewMode = "grid" | "list";

export function parseNewsViewMode(value: string | null): NewsViewMode {
  return value === "grid" ? "grid" : "list";
}
