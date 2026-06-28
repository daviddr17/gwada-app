import {
  type BusinessCardAccentStyle,
  type BusinessCardColors,
  type BusinessCardDesign,
  type BusinessCardElement,
  type BusinessCardElementType,
  type BusinessCardPresetId,
  type BusinessCardRect,
  defaultBusinessCardColors,
} from "@/lib/restaurant/business-card-design";
import {
  BUSINESS_CARD_CONTENT_W,
  BUSINESS_CARD_MARGIN_X,
} from "@/lib/restaurant/business-card-art-direction";
import type { BusinessCardTypographyId } from "@/lib/restaurant/business-card-typography";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

const MX = BUSINESS_CARD_MARGIN_X;
const CW = BUSINESS_CARD_CONTENT_W;

/** Kontaktzeile mit Icon + ggf. Telefon · Website */
const CONTACT_H = 12;

/** Anschrift: 3 Zeilen + Icon — entspricht DEFAULT_RECTS */
const ADDRESS_H = 18;

/** Öffnungszeiten: ~4 kompakte Zeilen + Titel */
const HOURS_H = 30;

export type BusinessCardPreset = {
  id: BusinessCardPresetId;
  label: string;
  description: string;
  typographyId: BusinessCardTypographyId;
  accentStyle: BusinessCardAccentStyle;
  colors: (accentHex: string) => BusinessCardColors;
  elements: Partial<
    Record<
      BusinessCardElementType,
      { side: BusinessCardElement["side"]; enabled: boolean; rect: BusinessCardRect }
    >
  >;
};

const PRESET_MODERN: BusinessCardPreset = {
  id: "modern",
  label: "Modern",
  description: "Reduziert, Name im Fokus",
  typographyId: "modern",
  accentStyle: "none",
  colors: (accentHex) => ({
    ...defaultBusinessCardColors(accentHex),
    background: "#ffffff",
    text: "#1d1d1f",
    muted: "#86868b",
  }),
  elements: {
    name: { side: "front", enabled: true, rect: { x: MX, y: 13, w: CW, h: 32 } },
    address: { side: "front", enabled: true, rect: { x: MX, y: 48, w: CW, h: ADDRESS_H } },
    phone: { side: "front", enabled: true, rect: { x: MX, y: 69, w: CW, h: CONTACT_H } },
    website: { side: "back", enabled: true, rect: { x: MX, y: 72, w: CW, h: 8 } },
    logo: { side: "back", enabled: true, rect: { x: 44, y: 8, w: 12, h: 20 } },
    cover: { side: "back", enabled: false, rect: { x: 0, y: 0, w: 100, h: 22 } },
    openingHours: { side: "back", enabled: true, rect: { x: MX, y: 34, w: 63, h: HOURS_H } },
    qrCode: { side: "back", enabled: true, rect: { x: 82, y: 36, w: 11, h: 22 } },
    gwadaFooter: { side: "back", enabled: false, rect: { x: MX, y: 92, w: CW, h: 6 } },
    gwadaFavicon: { side: "back", enabled: false, rect: { x: 84, y: 88, w: 10, h: 10 } },
  },
};

const PRESET_CLASSIC: BusinessCardPreset = {
  id: "classic",
  label: "Klassisch",
  description: "Editorial, Logo oben, Serifen-Titel",
  typographyId: "classic",
  accentStyle: "line",
  colors: (accentHex) => ({
    ...defaultBusinessCardColors(accentHex),
    background: "#faf9f7",
    text: "#1c1c1e",
    muted: "#6b6b70",
  }),
  elements: {
    logo: { side: "front", enabled: true, rect: { x: MX, y: 10, w: 9, h: 15 } },
    name: { side: "front", enabled: true, rect: { x: MX, y: 26, w: CW, h: 28 } },
    address: { side: "front", enabled: true, rect: { x: MX, y: 56, w: CW, h: ADDRESS_H } },
    phone: { side: "front", enabled: true, rect: { x: MX, y: 78, w: CW, h: CONTACT_H } },
    website: { side: "back", enabled: true, rect: { x: MX, y: 74, w: CW, h: 8 } },
    cover: { side: "back", enabled: true, rect: { x: 0, y: 0, w: 100, h: 18 } },
    openingHours: { side: "back", enabled: true, rect: { x: MX, y: 22, w: CW, h: HOURS_H } },
    qrCode: { side: "back", enabled: false, rect: { x: 81, y: 68, w: 12, h: 22 } },
    gwadaFooter: { side: "back", enabled: false, rect: { x: MX, y: 92, w: CW, h: 6 } },
    gwadaFavicon: { side: "back", enabled: false, rect: { x: 84, y: 88, w: 10, h: 10 } },
  },
};

const PRESET_PHOTO: BusinessCardPreset = {
  id: "photo",
  label: "Foto",
  description: "Magazin-Cover, Typo im Verlauf",
  typographyId: "modern",
  accentStyle: "coverGradient",
  colors: (accentHex) => ({
    accent: normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX,
    background: "#0c0c0c",
    text: "#ffffff",
    muted: "rgba(255,255,255,0.82)",
  }),
  elements: {
    cover: { side: "front", enabled: true, rect: { x: 0, y: 0, w: 100, h: 100 } },
    logo: { side: "front", enabled: true, rect: { x: 79, y: 8, w: 12, h: 20 } },
    name: { side: "front", enabled: true, rect: { x: MX, y: 56, w: CW, h: 17 } },
    address: { side: "front", enabled: true, rect: { x: MX, y: 74, w: CW, h: ADDRESS_H } },
    phone: { side: "back", enabled: true, rect: { x: MX, y: 47, w: CW, h: CONTACT_H } },
    website: { side: "back", enabled: true, rect: { x: MX, y: 60, w: 56, h: 8 } },
    openingHours: { side: "back", enabled: true, rect: { x: MX, y: 12, w: CW, h: HOURS_H } },
    qrCode: { side: "back", enabled: true, rect: { x: 78, y: 52, w: 14, h: 26 } },
    gwadaFooter: { side: "back", enabled: false, rect: { x: MX, y: 92, w: CW, h: 6 } },
    gwadaFavicon: { side: "back", enabled: false, rect: { x: 84, y: 88, w: 10, h: 10 } },
  },
};

const PRESET_DARK: BusinessCardPreset = {
  id: "dark",
  label: "Dark Premium",
  description: "Mattschwarz, Foto optional hinten",
  typographyId: "elegant",
  accentStyle: "none",
  colors: (accentHex) => {
    const accent = normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX;
    return {
      accent,
      background: "#141416",
      text: "#f5f5f7",
      muted: "#98989d",
    };
  },
  elements: {
    logo: { side: "front", enabled: true, rect: { x: MX, y: 14, w: 10, h: 18 } },
    name: { side: "front", enabled: true, rect: { x: 24, y: 13, w: 65, h: 26 } },
    address: { side: "front", enabled: true, rect: { x: MX, y: 42, w: CW, h: ADDRESS_H } },
    phone: { side: "front", enabled: true, rect: { x: MX, y: 64, w: CW, h: CONTACT_H } },
    website: { side: "back", enabled: true, rect: { x: MX, y: 74, w: CW, h: 8 } },
    cover: { side: "back", enabled: true, rect: { x: 0, y: 0, w: 100, h: 100 } },
    openingHours: { side: "back", enabled: true, rect: { x: MX, y: 52, w: 56, h: HOURS_H } },
    qrCode: { side: "back", enabled: true, rect: { x: 77, y: 54, w: 14, h: 26 } },
    gwadaFooter: { side: "back", enabled: false, rect: { x: MX, y: 92, w: CW, h: 6 } },
    gwadaFavicon: { side: "back", enabled: false, rect: { x: 84, y: 88, w: 10, h: 10 } },
  },
};

export const BUSINESS_CARD_PRESETS: Record<BusinessCardPresetId, BusinessCardPreset> = {
  classic: PRESET_CLASSIC,
  modern: PRESET_MODERN,
  photo: PRESET_PHOTO,
  dark: PRESET_DARK,
};

export const BUSINESS_CARD_PRESET_OPTIONS = Object.values(BUSINESS_CARD_PRESETS);

export function applyBusinessCardPreset(
  design: BusinessCardDesign,
  presetId: BusinessCardPresetId,
  accentHex: string,
  opts?: { hasCoverImage?: boolean },
): BusinessCardDesign {
  const preset = BUSINESS_CARD_PRESETS[presetId];
  const hasCover = opts?.hasCoverImage ?? true;

  const elements = design.elements.map((el) => {
    const patch = preset.elements[el.type];
    if (!patch) return el;

    let enabled = patch.enabled;
    if (el.type === "cover" && !hasCover) {
      enabled = false;
    }

    return {
      ...el,
      side: patch.side,
      enabled,
      rect: { ...patch.rect },
    };
  });

  return {
    ...design,
    presetId,
    typographyId: preset.typographyId,
    accentStyle: preset.accentStyle,
    colors: {
      ...preset.colors(accentHex),
      accent: normalizeHex(accentHex) ?? preset.colors(accentHex).accent,
    },
    elements,
    decorations: design.decorations,
  };
}
