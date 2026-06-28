import type { BusinessCardPresetId, BusinessCardSide } from "@/lib/restaurant/business-card-design";
import { normalizeHex } from "@/lib/theme/color-utils";

/** Einheitlicher Seitenrand (~9 mm bei EU-Standard). */
export const BUSINESS_CARD_MARGIN_X = 11;
export const BUSINESS_CARD_CONTENT_W = 100 - 2 * BUSINESS_CARD_MARGIN_X;

export type BusinessCardLogoStyle = "circle" | "squircle";

export type PresetArtDirection = {
  logoStyle: BusinessCardLogoStyle;
  /** „Telefon · Website“ in einer Zeile — separates Website-Element ausblenden. */
  combineContactOnPhone: boolean;
  hoursTitleUppercase: boolean;
  qrMinimal: boolean;
  faceAtmosphere: (accentHex: string, backgroundHex: string) => string | null;
};

const DEFAULT_ART: PresetArtDirection = {
  logoStyle: "circle",
  combineContactOnPhone: false,
  hoursTitleUppercase: false,
  qrMinimal: false,
  faceAtmosphere: () => null,
};

function accentWash(accentHex: string, alphaHex: string): string {
  const accent = normalizeHex(accentHex) ?? "#888888";
  return `${accent}${alphaHex}`;
}

export function businessCardPresetArtDirection(
  presetId: BusinessCardPresetId | undefined,
): PresetArtDirection {
  switch (presetId) {
    case "modern":
      return {
        logoStyle: "squircle",
        combineContactOnPhone: true,
        hoursTitleUppercase: true,
        qrMinimal: true,
        faceAtmosphere: (accent, bg) =>
          `radial-gradient(ellipse 90% 75% at 0% 0%, ${accentWash(accent, "0c")} 0%, transparent 55%), ${bg}`,
      };
    case "classic":
      return {
        logoStyle: "circle",
        combineContactOnPhone: true,
        hoursTitleUppercase: true,
        qrMinimal: true,
        faceAtmosphere: () => null,
      };
    case "photo":
      return {
        logoStyle: "circle",
        combineContactOnPhone: false,
        hoursTitleUppercase: false,
        qrMinimal: true,
        faceAtmosphere: () => null,
      };
    case "dark":
      return {
        logoStyle: "squircle",
        combineContactOnPhone: true,
        hoursTitleUppercase: true,
        qrMinimal: true,
        faceAtmosphere: (accent, bg) =>
          `radial-gradient(ellipse 95% 80% at 100% 0%, ${accentWash(accent, "16")} 0%, transparent 52%), ${bg}`,
      };
    default:
      return DEFAULT_ART;
  }
}

/** Feine Trennlinie zwischen Name- und Kontaktblock (nur Modern). */
export function businessCardPresetStructureLine(
  presetId: BusinessCardPresetId | undefined,
  side: BusinessCardSide,
): { topPct: number; opacity: number } | null {
  if (presetId === "modern" && side === "front") {
    return { topPct: 46, opacity: 0.08 };
  }
  if (presetId === "dark" && side === "front") {
    return { topPct: 42, opacity: 0.12 };
  }
  return null;
}
