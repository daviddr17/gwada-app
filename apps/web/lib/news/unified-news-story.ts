import type { NewsPlatform } from "@/lib/constants/news-platforms";

export type NewsStoryPlatform = Extract<NewsPlatform, "gwada" | "facebook" | "instagram">;

export type NewsStorySlideKind = "image" | "video";

export type UnifiedNewsStorySlide = {
  id: string;
  platform: NewsStoryPlatform;
  kind: NewsStorySlideKind;
  url: string;
  caption: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
};

export type UnifiedNewsStoryRing = {
  id: string;
  platform: NewsStoryPlatform;
  title: string;
  coverUrl: string;
  slideIds: string[];
  slides: UnifiedNewsStorySlide[];
};

export type NewsStoriesSyncMeta = {
  lastSyncedAt: string | null;
  stale: boolean;
  platformErrors: Partial<Record<Extract<NewsPlatform, "facebook" | "instagram">, string>>;
  platformItemCounts: Partial<Record<Extract<NewsPlatform, "facebook" | "instagram">, number>>;
};
