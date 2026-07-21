import type { NewsPlatform } from "@/lib/constants/news-platforms";
import {
  parseSocialPublishPlatforms,
  SOCIAL_DEFAULT_PUBLISH_PLATFORMS,
} from "@/lib/social/social-publish-platforms";

export const SOCIAL_IMAGE_STRATEGIES = [
  "own_first",
  "mix",
  "ai_strong",
] as const;
export type SocialImageStrategy = (typeof SOCIAL_IMAGE_STRATEGIES)[number];

export const SOCIAL_TONES = ["casual", "warm", "fine", "modern"] as const;
export type SocialTone = (typeof SOCIAL_TONES)[number];

export const SOCIAL_STYLE_PRESETS = [
  "modern_plain",
  "warm_gastro",
  "dark_fine",
] as const;
export type SocialStylePreset = (typeof SOCIAL_STYLE_PRESETS)[number];

export const SOCIAL_TEMPLATE_IDS = [
  "food_hero",
  "brand_card",
  "quote",
] as const;
export type SocialTemplateId = (typeof SOCIAL_TEMPLATE_IDS)[number];

export const SOCIAL_SLOT_KINDS = [
  "holiday",
  "menu_dish",
  "event",
  "brand",
  "ambient",
] as const;
export type SocialSlotKind = (typeof SOCIAL_SLOT_KINDS)[number];

export type SocialHeroAsset = {
  source: "gallery" | "menu" | "profile";
  id: string;
  label?: string;
};

export type SocialBrandKit = {
  restaurantId: string;
  enabled: boolean;
  imageStrategy: SocialImageStrategy;
  neverAiFood: boolean;
  tone: SocialTone;
  stylePreset: SocialStylePreset;
  voiceNotes: string;
  doNot: string;
  hashtags: string[];
  cta: string;
  weeklyPostTarget: number;
  goldCaptions: string[];
  heroAssets: SocialHeroAsset[];
  /** Zielkanäle (News): IG/FB/Google/WhatsApp/Gwada — zur Publish-Zeit gefiltert. */
  publishPlatforms: NewsPlatform[];
};

export const SOCIAL_IMAGE_STRATEGY_LABELS: Record<SocialImageStrategy, string> =
  {
    own_first: "Eigene Fotos zuerst",
    mix: "Mix (empfohlen)",
    ai_strong: "KI-stark (später)",
  };

export const SOCIAL_TONE_LABELS: Record<SocialTone, string> = {
  casual: "Locker",
  warm: "Warm & einladend",
  fine: "Fein & ruhig",
  modern: "Modern & klar",
};

export const SOCIAL_STYLE_PRESET_LABELS: Record<SocialStylePreset, string> = {
  modern_plain: "Modern schlicht",
  warm_gastro: "Warm gastronomisch",
  dark_fine: "Dunkel & fein",
};

export function defaultSocialBrandKit(restaurantId: string): SocialBrandKit {
  return {
    restaurantId,
    enabled: true,
    imageStrategy: "mix",
    neverAiFood: true,
    tone: "warm",
    stylePreset: "warm_gastro",
    voiceNotes: "",
    doNot: "",
    hashtags: [],
    cta: "Tisch reservieren",
    weeklyPostTarget: 3,
    goldCaptions: [],
    heroAssets: [],
    publishPlatforms: [...SOCIAL_DEFAULT_PUBLISH_PLATFORMS],
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function parseHeroAssets(value: unknown): SocialHeroAsset[] {
  if (!Array.isArray(value)) return [];
  const out: SocialHeroAsset[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const source = r.source;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    if (
      (source !== "gallery" && source !== "menu" && source !== "profile") ||
      !id
    ) {
      continue;
    }
    const label =
      typeof r.label === "string" && r.label.trim()
        ? r.label.trim().slice(0, 120)
        : undefined;
    out.push({ source, id, label });
    if (out.length >= 20) break;
  }
  return out;
}

export function parseSocialBrandKit(
  restaurantId: string,
  raw: unknown,
): SocialBrandKit {
  const base = defaultSocialBrandKit(restaurantId);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const imageStrategy = SOCIAL_IMAGE_STRATEGIES.includes(
    r.image_strategy as SocialImageStrategy,
  )
    ? (r.image_strategy as SocialImageStrategy)
    : base.imageStrategy;
  const tone = SOCIAL_TONES.includes(r.tone as SocialTone)
    ? (r.tone as SocialTone)
    : base.tone;
  const stylePreset = SOCIAL_STYLE_PRESETS.includes(
    r.style_preset as SocialStylePreset,
  )
    ? (r.style_preset as SocialStylePreset)
    : base.stylePreset;
  const weekly =
    typeof r.weekly_post_target === "number" &&
    Number.isFinite(r.weekly_post_target)
      ? Math.min(7, Math.max(1, Math.round(r.weekly_post_target)))
      : base.weeklyPostTarget;

  return {
    restaurantId,
    enabled: r.enabled !== false,
    imageStrategy,
    neverAiFood: r.never_ai_food !== false,
    tone,
    stylePreset,
    voiceNotes:
      typeof r.voice_notes === "string" ? r.voice_notes.slice(0, 2000) : "",
    doNot: typeof r.do_not === "string" ? r.do_not.slice(0, 2000) : "",
    hashtags: asStringArray(r.hashtags).map((h) =>
      h.startsWith("#") ? h : `#${h}`,
    ),
    cta:
      typeof r.cta === "string" && r.cta.trim()
        ? r.cta.trim().slice(0, 120)
        : base.cta,
    weeklyPostTarget: weekly,
    goldCaptions: asStringArray(r.gold_captions).slice(0, 10),
    heroAssets: parseHeroAssets(r.hero_assets),
    publishPlatforms: parseSocialPublishPlatforms(
      r.publish_platforms ?? r.publishPlatforms,
    ),
  };
}

export function socialBrandKitForPersistence(kit: SocialBrandKit) {
  return {
    restaurant_id: kit.restaurantId,
    enabled: kit.enabled,
    image_strategy: kit.imageStrategy,
    never_ai_food: kit.neverAiFood,
    tone: kit.tone,
    style_preset: kit.stylePreset,
    voice_notes: kit.voiceNotes.trim(),
    do_not: kit.doNot.trim(),
    hashtags: kit.hashtags,
    cta: kit.cta.trim(),
    weekly_post_target: kit.weeklyPostTarget,
    gold_captions: kit.goldCaptions,
    hero_assets: kit.heroAssets,
    publish_platforms: kit.publishPlatforms,
  };
}

export function parseSocialBrandKitFromClientBody(
  restaurantId: string,
  body: unknown,
): SocialBrandKit | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;
  const merged = {
    enabled: r.enabled,
    image_strategy: r.imageStrategy ?? r.image_strategy,
    never_ai_food: r.neverAiFood ?? r.never_ai_food,
    tone: r.tone,
    style_preset: r.stylePreset ?? r.style_preset,
    voice_notes: r.voiceNotes ?? r.voice_notes,
    do_not: r.doNot ?? r.do_not,
    hashtags: r.hashtags,
    cta: r.cta,
    weekly_post_target: r.weeklyPostTarget ?? r.weekly_post_target,
    gold_captions: r.goldCaptions ?? r.gold_captions,
    hero_assets: r.heroAssets ?? r.hero_assets,
    publish_platforms: r.publishPlatforms ?? r.publish_platforms,
  };
  return parseSocialBrandKit(restaurantId, merged);
}
