import { normalizeHex } from "@/lib/theme/color-utils";

/** Premium-Layouts der Feed-Familie (Agentur-System). */
export const SOCIAL_FEED_LAYOUT_IDS = [
  "editorial_hero",
  "atelier_split",
  "soiree_event",
  "signature_brand",
] as const;

export type SocialFeedLayoutId = (typeof SOCIAL_FEED_LAYOUT_IDS)[number];

export const SOCIAL_FEED_LAYOUT_LABELS: Record<SocialFeedLayoutId, string> = {
  editorial_hero: "Editorial Hero",
  atelier_split: "Atelier Split",
  soiree_event: "Soirée",
  signature_brand: "Signature Brand",
};

export const SOCIAL_FEED_LAYOUT_HINTS: Record<SocialFeedLayoutId, string> = {
  editorial_hero: "Gericht / Speisekarte — Foto full-bleed, wenig Text.",
  atelier_split: "Atmosphäre — Foto oben, Markenpanel unten.",
  soiree_event: "Events & Abende — Einladungs-Look.",
  signature_brand: "Marke / Feiertag — ruhig, Logo im Zentrum, optional soft Foto.",
};

export const SOCIAL_PHOTO_LOOKS = ["warm", "cool", "neutral"] as const;
export type SocialPhotoLook = (typeof SOCIAL_PHOTO_LOOKS)[number];

export const SOCIAL_PHOTO_LOOK_LABELS: Record<SocialPhotoLook, string> = {
  warm: "Warm",
  cool: "Cool",
  neutral: "Neutral",
};

export const SOCIAL_PHOTO_LOOK_HINTS: Record<SocialPhotoLook, string> = {
  warm: "Goldene Töne — einladend, abendlich.",
  cool: "Klarer, etwas kühlerer Look.",
  neutral: "Natürlich, wenig Grade.",
};

export type SocialFeedPalette = {
  accent: string;
  surfaceDark: string;
  surfaceLight: string;
  /** Optional — leer/null = nicht genutzt. */
  secondary: string | null;
};

export const DEFAULT_SOCIAL_FEED_PALETTE: SocialFeedPalette = {
  accent: "#c4a574",
  surfaceDark: "#1a1714",
  surfaceLight: "#f7f3ec",
  secondary: null,
};

export const DEFAULT_SOCIAL_PREFERRED_LAYOUTS: SocialFeedLayoutId[] = [
  "editorial_hero",
  "atelier_split",
  "signature_brand",
];

export function parseSocialPhotoLook(raw: unknown): SocialPhotoLook {
  if (typeof raw === "string" && SOCIAL_PHOTO_LOOKS.includes(raw as SocialPhotoLook)) {
    return raw as SocialPhotoLook;
  }
  return "warm";
}

export function parseFeedPaletteHex(
  raw: unknown,
  fallback: string,
): string {
  if (typeof raw !== "string") return fallback;
  return normalizeHex(raw) ?? fallback;
}

export function parseOptionalFeedPaletteHex(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return normalizeHex(trimmed);
}

export function parseSocialFeedPalette(raw: {
  accent?: unknown;
  surfaceDark?: unknown;
  surfaceLight?: unknown;
  secondary?: unknown;
}): SocialFeedPalette {
  return {
    accent: parseFeedPaletteHex(
      raw.accent,
      DEFAULT_SOCIAL_FEED_PALETTE.accent,
    ),
    surfaceDark: parseFeedPaletteHex(
      raw.surfaceDark,
      DEFAULT_SOCIAL_FEED_PALETTE.surfaceDark,
    ),
    surfaceLight: parseFeedPaletteHex(
      raw.surfaceLight,
      DEFAULT_SOCIAL_FEED_PALETTE.surfaceLight,
    ),
    secondary: parseOptionalFeedPaletteHex(raw.secondary),
  };
}

export function parsePreferredFeedLayouts(raw: unknown): SocialFeedLayoutId[] {
  const allowed = new Set<string>(SOCIAL_FEED_LAYOUT_IDS);
  const fromArray = Array.isArray(raw)
    ? raw.filter(
        (x): x is SocialFeedLayoutId =>
          typeof x === "string" && allowed.has(x),
      )
    : [];
  const unique = [...new Set(fromArray)];
  if (unique.length === 0) return [...DEFAULT_SOCIAL_PREFERRED_LAYOUTS];
  return unique.slice(0, SOCIAL_FEED_LAYOUT_IDS.length);
}

export function togglePreferredFeedLayout(
  current: SocialFeedLayoutId[],
  id: SocialFeedLayoutId,
  on: boolean,
): SocialFeedLayoutId[] {
  const set = new Set(current);
  if (on) set.add(id);
  else set.delete(id);
  const next = SOCIAL_FEED_LAYOUT_IDS.filter((layoutId) => set.has(layoutId));
  if (next.length === 0) return [id];
  return next;
}
