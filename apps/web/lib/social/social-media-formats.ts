import type { NewsPlatform } from "@/lib/constants/news-platforms";

/**
 * Master = 1:1 Feed. Andere Formate: Crop/Adapt ohne neuen LLM-Call.
 */
export const SOCIAL_MEDIA_FORMAT_IDS = [
  "square_1x1",
  "portrait_4x5",
  "landscape_4x3",
  "classic_5x4",
  "story_9x16",
] as const;

export type SocialMediaFormatId = (typeof SOCIAL_MEDIA_FORMAT_IDS)[number];

export type SocialMediaFormat = {
  id: SocialMediaFormatId;
  label: string;
  /** z. B. "1:1" */
  ratioLabel: string;
  width: number;
  height: number;
  /** Kurz: welche Kanäle davon profitieren. */
  platformHint: string;
};

export const SOCIAL_MEDIA_FORMATS: Record<
  SocialMediaFormatId,
  SocialMediaFormat
> = {
  square_1x1: {
    id: "square_1x1",
    label: "Quadrat",
    ratioLabel: "1:1",
    width: 1080,
    height: 1080,
    platformHint: "Universal — WhatsApp, Gwada, Grid-Vorschau",
  },
  portrait_4x5: {
    id: "portrait_4x5",
    label: "Hochformat Feed",
    ratioLabel: "4:5",
    width: 1080,
    height: 1350,
    platformHint: "Best für Instagram- & Facebook-Feed",
  },
  landscape_4x3: {
    id: "landscape_4x3",
    label: "Querformat",
    ratioLabel: "4:3",
    width: 1440,
    height: 1080,
    platformHint: "Gut für Google Business & Website",
  },
  classic_5x4: {
    id: "classic_5x4",
    label: "Klassisch",
    ratioLabel: "5:4",
    width: 1350,
    height: 1080,
    platformHint: "Ruhiges Querformat — Facebook & Google",
  },
  story_9x16: {
    id: "story_9x16",
    label: "Story",
    ratioLabel: "9:16",
    width: 1080,
    height: 1920,
    platformHint: "Instagram-/Facebook-Story (Hochkant)",
  },
};

/** Primäres Feed-Format je News-Kanal (Master bleibt 1:1 bis Publish). */
export const SOCIAL_PLATFORM_DEFAULT_FORMAT: Record<
  NewsPlatform,
  SocialMediaFormatId
> = {
  gwada: "square_1x1",
  facebook: "portrait_4x5",
  instagram: "portrait_4x5",
  google_business: "landscape_4x3",
  whatsapp_channel: "square_1x1",
};

export function parseSocialMediaFormatId(
  raw: unknown,
): SocialMediaFormatId | null {
  if (typeof raw !== "string") return null;
  return SOCIAL_MEDIA_FORMAT_IDS.includes(raw as SocialMediaFormatId)
    ? (raw as SocialMediaFormatId)
    : null;
}

export function cssAspectRatioForFormat(id: SocialMediaFormatId): string {
  const f = SOCIAL_MEDIA_FORMATS[id];
  return `${f.width} / ${f.height}`;
}

/**
 * Wählt Publish-Formate für verbundene Kanäle — Story separat (9:16).
 * Kein LLM; nur Crop vom Master.
 */
export function publishFormatsForPlatforms(params: {
  platforms: NewsPlatform[];
  publishStories: boolean;
  preferredFeedFormat?: SocialMediaFormatId | null;
}): {
  feed: SocialMediaFormatId;
  story: SocialMediaFormatId | null;
} {
  const preferred =
    params.preferredFeedFormat &&
    params.preferredFeedFormat !== "story_9x16"
      ? params.preferredFeedFormat
      : null;
  const first = params.platforms[0];
  const feed =
    preferred ??
    (first ? SOCIAL_PLATFORM_DEFAULT_FORMAT[first] : "square_1x1");
  const story =
    params.publishStories &&
    (params.platforms.includes("instagram") ||
      params.platforms.includes("facebook"))
      ? "story_9x16"
      : null;
  return { feed, story };
}
