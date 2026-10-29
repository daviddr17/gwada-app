import {
  SOCIAL_TONE_LABELS,
  type SocialBrandKit,
  type SocialTone,
} from "@/lib/social/social-brand-kit";
import {
  DEFAULT_SOCIAL_FEED_PALETTE,
  type SocialFeedLayoutId,
  type SocialFeedPalette,
} from "@/lib/social/social-feed-brand-system";
import { allSocialPublishPlatformOptions } from "@/lib/social/social-publish-platforms";
import { normalizeHex } from "@/lib/theme/color-utils";

const TONE_SAMPLE_LINES: Record<SocialTone, [string, string]> = {
  casual: [
    "Heute wieder volles Haus — kommt vorbei, wir freuen uns auf euch.",
    "Kurz & locker, wie wir sind.",
  ],
  warm: [
    "Wir haben den Tisch für euch gedeckt. Kommt vorbei und genießt den Abend bei uns.",
    "Herzlich willkommen — wir freuen uns auf euch.",
  ],
  fine: [
    "Ein ruhiger Abend, sorgfältig angerichtet — wir begrüßen Sie gerne bei uns.",
    "Fein und ruhig, ohne Lärm.",
  ],
  modern: [
    "Klarer Geschmack. Gute Atmosphäre. Reserviert euren Tisch.",
    "Klar, knapp, modern.",
  ],
};

export type SocialAutopilotPreviewIdentityClient = {
  name: string;
  logoUrl: string | null;
  coverUrl: string | null;
  accentHex: string;
};

/**
 * Deterministische Beispiel-Caption für die Live-Vorschau —
 * kein LLM, nur Stil-Parameter + optional Restaurantname.
 */
export function sampleCaptionFromBrandKit(
  kit: SocialBrandKit,
  restaurantName?: string,
): string {
  const gold = kit.goldCaptions.map((c) => c.trim()).find(Boolean);
  const voice = kit.voiceNotes.trim();
  const [toneLine] = TONE_SAMPLE_LINES[kit.tone];
  const name = restaurantName?.trim();
  const withName = (line: string) =>
    name && !line.toLowerCase().includes(name.toLowerCase())
      ? `${line.replace(/\s+$/, "")} — ${name}`
      : line;

  const base =
    gold ||
    (voice
      ? withName(
          voice
            .split(/[.!?\n]/)
            .map((s) => s.trim())
            .find(Boolean) ?? toneLine,
        )
      : withName(toneLine));

  const lines = [base.replace(/\s+/g, " ").trim()];
  const cta = kit.cta.trim();
  if (cta) lines.push(cta);
  const tags = kit.hashtags
    .map((h) => h.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((h) => (h.startsWith("#") ? h : `#${h}`));
  if (tags.length) lines.push(tags.join(" "));
  return lines.join("\n");
}

export function sampleTitleFromBrandKit(kit: SocialBrandKit): string {
  const gold = kit.goldCaptions.map((c) => c.trim()).find(Boolean);
  if (gold) {
    const first = gold.split(/[.!?\n]/)[0]?.trim();
    if (first && first.length <= 42) return first;
  }
  return SOCIAL_TONE_LABELS[kit.tone];
}

export function previewLayoutFromBrandKit(
  kit: SocialBrandKit,
): SocialFeedLayoutId {
  return kit.preferredLayouts[0] ?? "editorial_hero";
}

/**
 * Vorschau-Palette: Kit-Farben, Akzent aus Restaurant-Branding wenn Kit noch Default.
 */
export function previewPaletteFromBrandKit(
  kit: SocialBrandKit,
  restaurantAccentHex?: string | null,
): SocialFeedPalette {
  const accentFromRestaurant = normalizeHex(restaurantAccentHex ?? "");
  const kitAccent = normalizeHex(kit.feedPalette.accent);
  const stillDefaultAccent =
    !kitAccent ||
    kitAccent.toLowerCase() ===
      DEFAULT_SOCIAL_FEED_PALETTE.accent.toLowerCase();

  return {
    ...kit.feedPalette,
    accent:
      stillDefaultAccent && accentFromRestaurant
        ? accentFromRestaurant
        : (kitAccent ??
          accentFromRestaurant ??
          DEFAULT_SOCIAL_FEED_PALETTE.accent),
  };
}

export function publishPlatformsSummary(kit: SocialBrandKit): string {
  const labels = allSocialPublishPlatformOptions()
    .filter((o) => kit.publishPlatforms.includes(o.value))
    .map((o) => o.label);
  if (labels.length === 0) return "Keine Kanäle";
  if (kit.publishStories) {
    return `${labels.join(" · ")} · Story`;
  }
  return labels.join(" · ");
}
