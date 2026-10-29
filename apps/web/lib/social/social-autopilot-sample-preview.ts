import {
  SOCIAL_TONE_LABELS,
  type SocialBrandKit,
  type SocialTone,
} from "@/lib/social/social-brand-kit";
import type { SocialFeedLayoutId } from "@/lib/social/social-feed-brand-system";
import { allSocialPublishPlatformOptions } from "@/lib/social/social-publish-platforms";

const TONE_SAMPLE_LINES: Record<SocialTone, string> = {
  casual: "Heute wieder volles Haus — kommt vorbei, wir freuen uns auf euch.",
  warm: "Wir haben den Tisch für euch gedeckt. Kommt vorbei und genießt den Abend bei uns.",
  fine: "Ein ruhiger Abend, sorgfältig angerichtet — wir begrüßen Sie gerne bei uns.",
  modern: "Klarer Geschmack. Gute Atmosphäre. Reserviert euren Tisch.",
};

/**
 * Deterministische Beispiel-Caption für die Live-Vorschau —
 * kein LLM, nur Stil-Parameter aus dem Brand Kit.
 */
export function sampleCaptionFromBrandKit(kit: SocialBrandKit): string {
  const gold = kit.goldCaptions.map((c) => c.trim()).find(Boolean);
  const voice = kit.voiceNotes.trim();
  const base =
    gold ||
    (voice
      ? `${voice.split(/[.!?\n]/).map((s) => s.trim()).find(Boolean) ?? TONE_SAMPLE_LINES[kit.tone]}.`
      : TONE_SAMPLE_LINES[kit.tone]);

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
