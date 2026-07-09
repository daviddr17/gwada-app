import type { NewsPlatform } from "@/lib/constants/news-platforms";

export const SHARE_CHANNEL_KEYS = [
  "google_business_post",
  "facebook_post",
  "instagram_post",
  "facebook_story",
  "instagram_story",
] as const;

export type ShareChannelKey = (typeof SHARE_CHANNEL_KEYS)[number];

export type ShareChannelKind = "post" | "story";

export type ShareSourceType = "review" | "menu_item" | "gallery" | "news";

export const SHARE_SOURCE_TYPE_LABELS: Record<ShareSourceType, string> = {
  review: "Bewertung",
  menu_item: "Gericht",
  gallery: "Galerie",
  news: "News",
};

export type ShareChannelDefinition = {
  key: ShareChannelKey;
  platform: NewsPlatform;
  kind: ShareChannelKind;
  label: string;
  requiresImage: boolean;
};

export const SHARE_CHANNEL_DEFINITIONS: readonly ShareChannelDefinition[] = [
  {
    key: "google_business_post",
    platform: "google_business",
    kind: "post",
    label: "Google Beitrag",
    requiresImage: false,
  },
  {
    key: "facebook_post",
    platform: "facebook",
    kind: "post",
    label: "Facebook Beitrag",
    requiresImage: false,
  },
  {
    key: "instagram_post",
    platform: "instagram",
    kind: "post",
    label: "Instagram Beitrag",
    requiresImage: true,
  },
  {
    key: "facebook_story",
    platform: "facebook",
    kind: "story",
    label: "Facebook Story",
    requiresImage: true,
  },
  {
    key: "instagram_story",
    platform: "instagram",
    kind: "story",
    label: "Instagram Story",
    requiresImage: true,
  },
] as const;

export const SHARE_CHANNEL_LABELS: Record<ShareChannelKey, string> =
  Object.fromEntries(
    SHARE_CHANNEL_DEFINITIONS.map((d) => [d.key, d.label]),
  ) as Record<ShareChannelKey, string>;

export function isShareChannelKey(value: string): value is ShareChannelKey {
  return (SHARE_CHANNEL_KEYS as readonly string[]).includes(value);
}

export function isShareSourceType(value: string): value is ShareSourceType {
  return value === "review" ||
    value === "menu_item" ||
    value === "gallery" ||
    value === "news";
}

export function shareChannelDefinition(
  key: ShareChannelKey,
): ShareChannelDefinition {
  const def = SHARE_CHANNEL_DEFINITIONS.find((d) => d.key === key);
  if (!def) throw new Error(`unknown_share_channel:${key}`);
  return def;
}
