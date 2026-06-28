import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import type { BusinessCardTypographyId } from "@/lib/restaurant/business-card-typography";
import {
  decorationClampMins,
  isBusinessCardImageDecoration,
  parseBusinessCardDecorationItem,
  type BusinessCardDecorationItem,
  type BusinessCardImageDecoration,
  type BusinessCardShapeDecoration,
} from "@/lib/restaurant/business-card-shape-decoration";

export type BusinessCardDecoration = BusinessCardDecorationItem;

export type BusinessCardPresetId = "classic" | "modern" | "photo" | "dark";

export type BusinessCardAccentStyle = "none" | "line" | "sideBar" | "coverGradient";

export type BusinessCardElementType =
  | "name"
  | "address"
  | "phone"
  | "website"
  | "cover"
  | "logo"
  | "openingHours"
  | "gwadaFooter"
  | "gwadaFavicon"
  | "qrCode";

export type BusinessCardSide = "front" | "back";

export type BusinessCardFormatId =
  | "eu_85x55"
  | "eu_90x50"
  | "us_89x51"
  | "square_55";

export type BusinessCardFormat = {
  id: BusinessCardFormatId;
  label: string;
  widthMm: number;
  heightMm: number;
};

export const BUSINESS_CARD_FORMATS: Record<
  BusinessCardFormatId,
  BusinessCardFormat
> = {
  eu_85x55: {
    id: "eu_85x55",
    label: "EU Standard (85 × 55 mm)",
    widthMm: 85,
    heightMm: 55,
  },
  eu_90x50: {
    id: "eu_90x50",
    label: "EU alternativ (90 × 50 mm)",
    widthMm: 90,
    heightMm: 50,
  },
  us_89x51: {
    id: "us_89x51",
    label: "US Standard (3,5 × 2 Zoll)",
    widthMm: 89,
    heightMm: 51,
  },
  square_55: {
    id: "square_55",
    label: "Quadrat (55 × 55 mm)",
    widthMm: 55,
    heightMm: 55,
  },
};

export const BUSINESS_CARD_FORMAT_OPTIONS = Object.values(BUSINESS_CARD_FORMATS);

export type BusinessCardRect = {
  /** 0–100 % der Kartenbreite */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BusinessCardElement = {
  id: string;
  type: BusinessCardElementType;
  side: BusinessCardSide;
  enabled: boolean;
  rect: BusinessCardRect;
  /** 0–1, nur Cover/Logo; Standard 1 */
  opacity?: number;
};

export function clampBusinessCardOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function businessCardVisualOpacity(opacity: number | undefined): number {
  return opacity === undefined ? 1 : clampBusinessCardOpacity(opacity);
}

export type BusinessCardColors = {
  accent: string;
  background: string;
  text: string;
  muted: string;
};

export function hexRelativeLuminance(hex: string): number {
  const n = normalizeHex(hex);
  if (!n) return 1;
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixHexColors(hexA: string, hexB: string, amountB: number): string {
  const a = normalizeHex(hexA);
  const b = normalizeHex(hexB);
  if (!a || !b) return hexA;
  const t = Math.min(1, Math.max(0, amountB));
  const mix = (from: number, to: number) =>
    Math.round(from + (to - from) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(parseInt(a.slice(1, 3), 16), parseInt(b.slice(1, 3), 16))}${mix(parseInt(a.slice(3, 5), 16), parseInt(b.slice(3, 5), 16))}${mix(parseInt(a.slice(5, 7), 16), parseInt(b.slice(5, 7), 16))}`;
}

/** Dunkle Karten (z. B. Dark Premium) — helle Typo auf dunklem Grund. */
export function businessCardIsDarkTheme(colors: BusinessCardColors): boolean {
  return hexRelativeLuminance(colors.background) < 0.2;
}

export function businessCardUsesCoverOverlay(
  accentStyle: BusinessCardAccentStyle,
  colors: BusinessCardColors,
): boolean {
  return accentStyle === "coverGradient" || businessCardIsDarkTheme(colors);
}

export function businessCardUsesHoursPanel(colors: BusinessCardColors): boolean {
  return businessCardIsDarkTheme(colors);
}

/** Helle Typo auf Foto / dunklem Verlauf (z. B. Foto-Vorlage). */
export function businessCardUsesLightText(colors: BusinessCardColors): boolean {
  return hexRelativeLuminance(colors.text) > 0.72;
}

export function businessCardCoverOverlayBackground(
  colors: BusinessCardColors,
  accentStyle: BusinessCardAccentStyle,
): string {
  if (businessCardUsesLightText(colors)) {
    return "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.52) 28%, rgba(0,0,0,0.12) 55%, transparent 82%)";
  }
  if (accentStyle === "coverGradient") {
    return `linear-gradient(to top, ${colors.background}f5 0%, ${colors.background}88 36%, transparent 70%)`;
  }
  return `linear-gradient(to top, ${colors.background}ee 0%, ${colors.background}55 42%, transparent 76%)`;
}

export function businessCardReadableAccent(colors: BusinessCardColors): string {
  const accent = normalizeHex(colors.accent) ?? DEFAULT_ACCENT_HEX;
  if (!businessCardIsDarkTheme(colors)) return accent;
  if (hexRelativeLuminance(accent) >= 0.52) return accent;
  return mixHexColors(accent, colors.text, 0.55);
}

export function businessCardSecondaryTextColor(colors: BusinessCardColors): string {
  if (!businessCardIsDarkTheme(colors)) return colors.muted;
  if (hexRelativeLuminance(colors.muted) >= 0.58) return colors.muted;
  return mixHexColors(colors.muted, colors.text, 0.42);
}

export function businessCardElementStackClassName(
  elementType: BusinessCardElementType,
  design: BusinessCardDesign,
  opts?: { isCoverFull?: boolean },
): string {
  const isCoverFull = opts?.isCoverFull ?? false;
  const hoursPanel = businessCardUsesHoursPanel(design.colors);

  if (elementType === "cover") return "z-0";
  if (elementType === "logo" && isCoverFull) return "z-[3]";
  if (elementType === "openingHours" && hoursPanel) return "z-[3]";
  return "z-[2]";
}

/** Formen/Deko-Bilder über Titelbild, unter Text. */
export const businessCardDecorationStackClassName = "z-[1]";

export type BusinessCardDesign = {
  formatId: BusinessCardFormatId;
  /** Zuletzt angewendete Stil-Vorlage (optional). */
  presetId?: BusinessCardPresetId;
  typographyId: BusinessCardTypographyId;
  accentStyle: BusinessCardAccentStyle;
  colors: BusinessCardColors;
  elements: BusinessCardElement[];
  decorations: BusinessCardDecoration[];
};

export const BUSINESS_CARD_DECORATION_LIMIT = 16;

export const BUSINESS_CARD_DECORATION_MINS = { minW: 6, minH: 6 };

/** Logo-Kreis als Anteil der Element-Box — Platz für Rand und Schatten. */
export const BUSINESS_CARD_LOGO_INNER_SCALE = 0.9;

/** Innenabstand zwischen Kreis-Rand und Bild (Prozent der Kreisfläche). */
export const BUSINESS_CARD_LOGO_IMAGE_INSET_PCT = 8;

export function businessCardLogoDisplaySidePx(
  rect: BusinessCardRect,
  cardWidthPx: number,
  cardHeightPx: number,
): number {
  const boxWPx = (rect.w / 100) * cardWidthPx;
  const boxHPx = (rect.h / 100) * cardHeightPx;
  return Math.min(boxWPx, boxHPx) * BUSINESS_CARD_LOGO_INNER_SCALE;
}

export const BUSINESS_CARD_ELEMENT_DEFS: Record<
  BusinessCardElementType,
  {
    label: string;
    description: string;
    defaultSide: BusinessCardSide;
    minW: number;
    minH: number;
    canDisable: boolean;
  }
> = {
  name: {
    label: "Name",
    description: "Restaurantname",
    defaultSide: "front",
    minW: 20,
    minH: 8,
    canDisable: false,
  },
  address: {
    label: "Anschrift",
    description: "Straße, PLZ, Ort",
    defaultSide: "front",
    minW: 24,
    minH: 10,
    canDisable: true,
  },
  phone: {
    label: "Telefon",
    description: "Rufnummer",
    defaultSide: "front",
    minW: 18,
    minH: 6,
    canDisable: true,
  },
  website: {
    label: "Website",
    description: "Internetadresse",
    defaultSide: "front",
    minW: 18,
    minH: 6,
    canDisable: true,
  },
  cover: {
    label: "Titelbild",
    description: "Profil-Titelbild",
    defaultSide: "back",
    minW: 30,
    minH: 12,
    canDisable: true,
  },
  logo: {
    label: "Logo",
    description: "Profilbild / Initialen",
    defaultSide: "back",
    minW: 14,
    minH: 18,
    canDisable: true,
  },
  openingHours: {
    label: "Öffnungszeiten",
    description: "Kompakter Wochenplan",
    defaultSide: "back",
    minW: 30,
    minH: 14,
    canDisable: true,
  },
  gwadaFooter: {
    label: "„Erstellt mit Gwada“",
    description: "Kleiner Hinweis",
    defaultSide: "back",
    minW: 24,
    minH: 5,
    canDisable: true,
  },
  gwadaFavicon: {
    label: "Gwada-Favicon",
    description: "Plattform-Icon",
    defaultSide: "back",
    minW: 6,
    minH: 6,
    canDisable: true,
  },
  qrCode: {
    label: "QR-Code",
    description: "Link zur Website",
    defaultSide: "front",
    minW: 10,
    minH: 14,
    canDisable: true,
  },
};

const DEFAULT_RECTS: Record<
  BusinessCardElementType,
  BusinessCardRect
> = {
  name: { x: 11, y: 14, w: 78, h: 24 },
  address: { x: 11, y: 38, w: 78, h: 18 },
  phone: { x: 11, y: 58, w: 78, h: 8 },
  website: { x: 11, y: 65, w: 78, h: 8 },
  cover: { x: 0, y: 0, w: 100, h: 22 },
  logo: { x: 38, y: 24, w: 24, h: 37 },
  openingHours: { x: 7, y: 62, w: 86, h: 26 },
  gwadaFooter: { x: 7, y: 91, w: 86, h: 7 },
  gwadaFavicon: { x: 84, y: 88, w: 10, h: 10 },
  qrCode: { x: 78, y: 58, w: 18, h: 30 },
};

export function businessCardFormatAspect(formatId: BusinessCardFormatId): number {
  const f = BUSINESS_CARD_FORMATS[formatId];
  return f.widthMm / f.heightMm;
}

export function businessCardFormatById(
  formatId: BusinessCardFormatId,
): BusinessCardFormat {
  return BUSINESS_CARD_FORMATS[formatId];
}

function elementId(type: BusinessCardElementType): string {
  return `bc-${type}`;
}

export function defaultBusinessCardColors(accentHex: string): BusinessCardColors {
  return {
    accent: normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX,
    background: "#ffffff",
    text: "#1d1d1f",
    muted: "#86868b",
  };
}

export function createDefaultBusinessCardDesign(
  accentHex: string,
  opts?: { hasCoverImage?: boolean },
): BusinessCardDesign {
  const hasCover = opts?.hasCoverImage ?? true;
  const types = Object.keys(BUSINESS_CARD_ELEMENT_DEFS) as BusinessCardElementType[];

  return {
    formatId: "eu_85x55",
    typographyId: "modern",
    accentStyle: "none",
    colors: defaultBusinessCardColors(accentHex),
    elements: types.map((type) => ({
      id: elementId(type),
      type,
      side: BUSINESS_CARD_ELEMENT_DEFS[type].defaultSide,
      enabled:
        type === "name" ||
        (type === "cover" ? hasCover : type !== "gwadaFavicon" && type !== "qrCode"),
      rect: { ...DEFAULT_RECTS[type] },
    })),
    decorations: [],
  };
}

export function clampBusinessCardRect(rect: BusinessCardRect, mins: { minW: number; minH: number }): BusinessCardRect {
  const w = Math.max(mins.minW, Math.min(100, rect.w));
  const h = Math.max(mins.minH, Math.min(100, rect.h));
  const x = Math.max(0, Math.min(100 - w, rect.x));
  const y = Math.max(0, Math.min(100 - h, rect.y));
  return { x, y, w, h };
}

export function isBusinessCardSquareElement(type: BusinessCardElementType): boolean {
  return type === "logo" || type === "gwadaFavicon" || type === "qrCode";
}

export function isBusinessCardTextElement(type: BusinessCardElementType): boolean {
  return type !== "cover" && type !== "logo" && type !== "gwadaFavicon" && type !== "qrCode";
}

/** pt pro mm — gleiche Box-Höhen-Ratio wie Editor (font = boxH × factor). */
export const BUSINESS_CARD_PT_PER_MM = 72 / 25.4;

/** Schriftgröße in pt aus Rechteck-Höhe (% der Karte) — spiegelt Editor-Ratio. */
export function businessCardFontSizePt(
  rect: BusinessCardRect,
  factor: number,
  formatId: BusinessCardFormatId,
): number {
  const format = BUSINESS_CARD_FORMATS[formatId];
  const boxHMm = (rect.h / 100) * format.heightMm;
  return Math.max(4.5, boxHMm * factor * BUSINESS_CARD_PT_PER_MM);
}

export function businessCardFontSizeCssPx(
  rect: BusinessCardRect,
  factor: number,
  formatId: BusinessCardFormatId,
): number {
  return businessCardFontSizePt(rect, factor, formatId) * (96 / 72);
}

/** Zeilenhöhe Adresse — Platz für Unterlängen, passt zur Mehrzeilen-Schriftberechnung. */
export const BUSINESS_CARD_ADDRESS_LINE_HEIGHT = 1.45;

/** Zeilenhöhe Name — etwas Luft für Unterlängen (g, y, p). */
export const BUSINESS_CARD_NAME_LINE_HEIGHT = 1.16;

export function businessCardNameLineCount(name: string): number {
  const trimmed = name.trim();
  if (!trimmed) return 1;
  const charsPerLine = trimmed.length > 28 ? 14 : 18;
  return Math.min(3, Math.max(1, Math.ceil(trimmed.length / charsPerLine)));
}

/** Adresszeilen inkl. möglichem Umbruch langer Straßen — für Schriftberechnung. */
export function businessCardAddressVisualLineCount(lines: string[]): number {
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    count += trimmed.length > 24 ? 2 : 1;
  }
  return Math.max(1, count);
}

/** Adress-Schrift: passt Zeilen in die Box, Zielgröße analog Telefon-Zeile. */
export function businessCardAddressBodyFontSizeCssPx(
  rect: BusinessCardRect,
  lineCount: number,
  canvasHeightPx: number,
  verticalPadPx: number,
): number {
  if (canvasHeightPx <= 0) return 10;

  const boxHPx = (rect.h / 100) * canvasHeightPx;
  const lines = Math.max(1, lineCount);

  let byFit = businessCardEditorMultilineFontSizeCssPx(
    rect,
    lines,
    canvasHeightPx,
    { verticalPadPx, lineHeight: BUSINESS_CARD_ADDRESS_LINE_HEIGHT },
  );
  byFit = businessCardEditorMultilineFontSizeCssPx(
    rect,
    lines,
    canvasHeightPx,
    {
      verticalPadPx: verticalPadPx + byFit * 0.16,
      lineHeight: BUSINESS_CARD_ADDRESS_LINE_HEIGHT,
    },
  );

  const byFactor = boxHPx * 0.255;
  return Math.max(7, Math.min(byFactor, byFit));
}

/** Telefon / Kontaktzeile — eine Zeile mit Icon, etwas kräftiger als reine Fit-Skalierung. */
export function businessCardContactLineFontSizeCssPx(
  rect: BusinessCardRect,
  canvasHeightPx: number,
  opts?: { combinedLine?: boolean },
): number {
  if (canvasHeightPx <= 0) return 10;
  const boxHPx = (rect.h / 100) * canvasHeightPx;
  const factor = opts?.combinedLine ? 0.29 : 0.32;
  return Math.max(8, boxHPx * factor);
}

/** Name-Schrift: skaliert mit Box-Höhe, Zeilenanzahl, Akzent-Linie und Padding. */
export function businessCardEditorNameFontSizeCssPx(
  rect: BusinessCardRect,
  canvasHeightPx: number,
  opts: {
    lineCount: number;
    nameScale: number;
    hasAccentLine: boolean;
    verticalPadPx: number;
  },
): number {
  if (canvasHeightPx <= 0) return 10;

  const lines = Math.max(1, Math.min(3, opts.lineCount));
  const boxHPx = (rect.h / 100) * canvasHeightPx;
  const accentPx = opts.hasAccentLine ? Math.max(4, boxHPx * 0.06) : 0;
  const availableHPx = Math.max(0, boxHPx - opts.verticalPadPx - accentPx);
  const byHeight = availableHPx / lines / BUSINESS_CARD_NAME_LINE_HEIGHT;
  const byFactor = boxHPx * 0.4 * opts.nameScale;

  return Math.max(7, Math.min(byFactor, byHeight));
}

/** Zeilenhöhe Öffnungszeiten — passt zur Mehrzeilen-Schriftberechnung. */
export const BUSINESS_CARD_OPENING_HOURS_LINE_HEIGHT = 1.22;

/** Titel + Abstand ≈ Anteil einer Body-Zeilenhöhe in der Schriftberechnung. */
export const BUSINESS_CARD_OPENING_HOURS_TITLE_LINE_FACTOR = 1.2;

/** Body-Schrift: skaliert mit Box-Höhe und passt Titel + Zeilen in die Box. */
export function businessCardOpeningHoursBodyFontSizeCssPx(
  rect: BusinessCardRect,
  rowCount: number,
  canvasHeightPx: number,
  opts?: {
    verticalPadPx?: number;
    titleLineFactor?: number;
  },
): number {
  if (canvasHeightPx <= 0) return 10;

  const rows = Math.max(1, rowCount);
  const titleFactor = opts?.titleLineFactor ?? BUSINESS_CARD_OPENING_HOURS_TITLE_LINE_FACTOR;
  const visualLines = rows + titleFactor;
  const verticalPad = opts?.verticalPadPx ?? 8;

  let size = businessCardEditorMultilineFontSizeCssPx(
    rect,
    visualLines,
    canvasHeightPx,
    { lineHeight: BUSINESS_CARD_OPENING_HOURS_LINE_HEIGHT, verticalPadPx: verticalPad },
  );
  size = businessCardEditorMultilineFontSizeCssPx(
    rect,
    visualLines,
    canvasHeightPx,
    {
      lineHeight: BUSINESS_CARD_OPENING_HOURS_LINE_HEIGHT,
      verticalPadPx: verticalPad + size * 0.2,
    },
  );

  return size;
}

/** Editor: Schriftgröße so, dass `lineCount` Zeilen in die Box-Höhe passen. */
export function businessCardEditorMultilineFontSizeCssPx(
  rect: BusinessCardRect,
  lineCount: number,
  canvasHeightPx: number,
  opts?: {
    lineHeight?: number;
    /** Innenabstand oben + unten (contentPad, textInset). */
    verticalPadPx?: number;
  },
): number {
  if (canvasHeightPx <= 0) return 10;
  const lines = Math.max(1, lineCount);
  const lineHeight = opts?.lineHeight ?? BUSINESS_CARD_ADDRESS_LINE_HEIGHT;
  const verticalPad = opts?.verticalPadPx ?? 4;
  const boxHPx = (rect.h / 100) * canvasHeightPx;
  const availableHPx = Math.max(0, boxHPx - verticalPad);
  return Math.max(6, availableHPx / lines / lineHeight);
}

/** Editor-Vorschau: Schrift skaliert direkt mit der gerenderten Box-Höhe. */
export function businessCardEditorFontSizeCssPx(
  rect: BusinessCardRect,
  factor: number,
  canvasHeightPx: number,
): number {
  if (canvasHeightPx <= 0) return 10;
  const boxHPx = (rect.h / 100) * canvasHeightPx;
  return Math.max(7, boxHPx * factor);
}

export function businessCardRectHeightMm(
  rect: BusinessCardRect,
  formatId: BusinessCardFormatId,
): number {
  return (rect.h / 100) * BUSINESS_CARD_FORMATS[formatId].heightMm;
}

/** Logo ist pixel-quadratisch: Höhe in % = Breite in % × Karten-Seitenverhältnis. */
export function businessCardSquareHeightPct(
  widthPct: number,
  formatId: BusinessCardFormatId,
): number {
  return widthPct * businessCardFormatAspect(formatId);
}

export function normalizeSquareBusinessCardRect(
  rect: BusinessCardRect,
  formatId: BusinessCardFormatId,
  mins: { minW: number; minH: number },
): BusinessCardRect {
  const cardAspect = businessCardFormatAspect(formatId);
  let w = Math.max(mins.minW, rect.w);
  let h = w * cardAspect;
  const minHFromMinW = mins.minW * cardAspect;
  if (h < Math.max(mins.minH, minHFromMinW)) {
    h = Math.max(mins.minH, minHFromMinW);
    w = h / cardAspect;
  }
  w = Math.min(100, w);
  h = Math.min(100, h);
  const x = Math.max(0, Math.min(100 - w, rect.x));
  const y = Math.max(0, Math.min(100 - h, rect.y));
  return { x, y, w, h };
}

export function updateBusinessCardElement(
  design: BusinessCardDesign,
  elementId: string,
  patch: Partial<Pick<BusinessCardElement, "enabled" | "side" | "rect" | "opacity">>,
): BusinessCardDesign {
  return {
    ...design,
    elements: design.elements.map((el) => {
      if (el.id !== elementId) return el;
      const def = BUSINESS_CARD_ELEMENT_DEFS[el.type];
      const next: BusinessCardElement = {
        ...el,
        ...patch,
        opacity:
          patch.opacity !== undefined
            ? clampBusinessCardOpacity(patch.opacity)
            : el.opacity,
        rect: patch.rect
          ? isBusinessCardSquareElement(el.type)
            ? normalizeSquareBusinessCardRect(patch.rect, design.formatId, def)
            : clampBusinessCardRect(patch.rect, def)
          : el.rect,
      };
      return next;
    }),
  };
}

export function setBusinessCardElementEnabled(
  design: BusinessCardDesign,
  type: BusinessCardElementType,
  enabled: boolean,
): BusinessCardDesign {
  const id = elementId(type);
  const existing = design.elements.find((e) => e.type === type);
  if (existing) {
    return updateBusinessCardElement(design, id, { enabled });
  }
  const def = BUSINESS_CARD_ELEMENT_DEFS[type];
  return {
    ...design,
    elements: [
      ...design.elements,
      {
        id,
        type,
        side: def.defaultSide,
        enabled,
        rect: { ...DEFAULT_RECTS[type] },
      },
    ],
  };
}

export function setBusinessCardFormat(
  design: BusinessCardDesign,
  formatId: BusinessCardFormatId,
): BusinessCardDesign {
  if (design.formatId === formatId) return design;
  return {
    ...design,
    formatId,
    elements: design.elements.map((el) => {
      const rect = { ...DEFAULT_RECTS[el.type] };
      const def = BUSINESS_CARD_ELEMENT_DEFS[el.type];
      return {
        ...el,
        rect: isBusinessCardSquareElement(el.type)
          ? normalizeSquareBusinessCardRect(rect, formatId, def)
          : rect,
      };
    }),
  };
}

export function enabledBusinessCardTypes(
  design: BusinessCardDesign,
): Set<BusinessCardElementType> {
  return new Set(
    design.elements.filter((e) => e.enabled).map((e) => e.type),
  );
}

export function activeElementsForSide(
  design: BusinessCardDesign,
  side: BusinessCardSide,
): BusinessCardElement[] {
  return design.elements.filter((e) => e.enabled && e.side === side);
}

export function activeDecorationsForSide(
  design: BusinessCardDesign,
  side: BusinessCardSide,
): BusinessCardDecoration[] {
  return (design.decorations ?? []).filter((d) => d.side === side);
}

export function createBusinessCardDecorationId(): string {
  return `bc-dec-${crypto.randomUUID()}`;
}

export function defaultDecorationRect(
  imageAspect: number,
  formatId: BusinessCardFormatId,
  center?: { xPct: number; yPct: number },
): BusinessCardRect {
  const cardAspect = businessCardFormatAspect(formatId);
  const w = 28;
  const h = (w * cardAspect) / imageAspect;
  const cx = center?.xPct ?? 50;
  const cy = center?.yPct ?? 50;
  return clampBusinessCardRect(
    { x: cx - w / 2, y: cy - h / 2, w, h },
    BUSINESS_CARD_DECORATION_MINS,
  );
}

export function addBusinessCardDecoration(
  design: BusinessCardDesign,
  decoration:
    | (Omit<BusinessCardImageDecoration, "id"> & { id?: string })
    | (Omit<BusinessCardShapeDecoration, "id"> & { id?: string }),
): BusinessCardDesign {
  const decorations = design.decorations ?? [];
  if (decorations.length >= BUSINESS_CARD_DECORATION_LIMIT) return design;
  const next = {
    ...decoration,
    id: decoration.id ?? createBusinessCardDecorationId(),
  } as BusinessCardDecoration;
  return {
    ...design,
    decorations: [...decorations, next],
  };
}

export function removeBusinessCardDecoration(
  design: BusinessCardDesign,
  decorationId: string,
): BusinessCardDesign {
  return {
    ...design,
    decorations: (design.decorations ?? []).filter((d) => d.id !== decorationId),
  };
}

export function updateBusinessCardDecoration(
  design: BusinessCardDesign,
  decorationId: string,
  patch: Partial<Pick<BusinessCardDecoration, "side" | "rect">> & {
    color?: string;
    opacity?: number;
    filled?: boolean;
    lineWidth?: number;
  },
): BusinessCardDesign {
  return {
    ...design,
    decorations: (design.decorations ?? []).map((d) => {
      if (d.id !== decorationId) return d;
      const merged = { ...d, ...patch } as BusinessCardDecoration;
      if (patch.opacity !== undefined) {
        merged.opacity = clampBusinessCardOpacity(patch.opacity);
      }
      const mins = decorationClampMins(merged);
      return {
        ...merged,
        rect: patch.rect
          ? clampBusinessCardRect(patch.rect, mins)
          : d.rect,
      };
    }),
  };
}

function normalizeBusinessCardDesign(parsed: BusinessCardDesign): BusinessCardDesign {
  const types = Object.keys(BUSINESS_CARD_ELEMENT_DEFS) as BusinessCardElementType[];
  const existingTypes = new Set(parsed.elements.map((element) => element.type));
  const missingElements = types
    .filter((type) => !existingTypes.has(type))
    .map((type) => ({
      id: elementId(type),
      type,
      side: BUSINESS_CARD_ELEMENT_DEFS[type].defaultSide,
      enabled: type !== "gwadaFavicon" && type !== "qrCode",
      rect: { ...DEFAULT_RECTS[type] },
    }));

  const decorations = (Array.isArray(parsed.decorations) ? parsed.decorations : [])
    .map((item) => parseBusinessCardDecorationItem(item))
    .filter((item): item is BusinessCardDecoration => item !== null);

  return {
    ...parsed,
    elements: [...parsed.elements, ...missingElements],
    decorations,
  };
}

const BUSINESS_CARD_FORMAT_IDS = new Set<BusinessCardFormatId>(
  Object.keys(BUSINESS_CARD_FORMATS) as BusinessCardFormatId[],
);

/** JSON aus DB/localStorage in typisiertes Design — sonst `null`. */
export function parseBusinessCardDesign(raw: unknown): BusinessCardDesign | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Partial<BusinessCardDesign>;
  if (
    !parsed.formatId
    || !BUSINESS_CARD_FORMAT_IDS.has(parsed.formatId)
    || !parsed.colors
    || typeof parsed.colors !== "object"
    || !Array.isArray(parsed.elements)
  ) {
    return null;
  }

  return normalizeBusinessCardDesign({
    formatId: parsed.formatId,
    presetId:
      parsed.presetId === "classic"
      || parsed.presetId === "modern"
      || parsed.presetId === "photo"
      || parsed.presetId === "dark"
        ? parsed.presetId
        : undefined,
    typographyId:
      parsed.typographyId === "classic"
      || parsed.typographyId === "modern"
      || parsed.typographyId === "elegant"
        ? parsed.typographyId
        : "modern",
    accentStyle:
      parsed.accentStyle === "none"
      || parsed.accentStyle === "sideBar"
      || parsed.accentStyle === "coverGradient"
      || parsed.accentStyle === "line"
        ? parsed.accentStyle
        : "none",
    colors: parsed.colors,
    elements: parsed.elements as BusinessCardElement[],
    decorations: Array.isArray(parsed.decorations) ? parsed.decorations : [],
  });
}

/** Persistenz: keine Data-URLs — Dekorbilder nur via `documentId`. */
export function businessCardDesignForPersistence(
  design: BusinessCardDesign,
): BusinessCardDesign {
  return {
    ...design,
    decorations: (design.decorations ?? []).map((decoration) => {
      if (!isBusinessCardImageDecoration(decoration) || !decoration.dataUrl) {
        return decoration;
      }
      const { dataUrl: _dataUrl, ...rest } = decoration;
      return rest;
    }),
  };
}

const STORAGE_PREFIX = "gwada:business-card-design:";

export function loadStoredBusinessCardDesign(
  restaurantId: string,
): BusinessCardDesign | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${restaurantId}`);
    if (!raw) return null;
    return parseBusinessCardDesign(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStoredBusinessCardDesign(
  restaurantId: string,
  design: BusinessCardDesign,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${restaurantId}`,
      JSON.stringify(businessCardDesignForPersistence(design)),
    );
  } catch {
    /* quota */
  }
}

/** @deprecated Legacy toggles — nur für Content-Builder-Mapping */
export type BusinessCardOptions = {
  showCover: boolean;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  showOpeningHours: boolean;
  showGwadaFooter: boolean;
  showGwadaFavicon: boolean;
  showQrCode: boolean;
};

export function businessCardOptionsFromDesign(
  design: BusinessCardDesign,
): BusinessCardOptions {
  const enabled = enabledBusinessCardTypes(design);
  return {
    showCover: enabled.has("cover"),
    showLogo: enabled.has("logo"),
    showAddress: enabled.has("address"),
    showPhone: enabled.has("phone"),
    showWebsite: enabled.has("website"),
    showOpeningHours: enabled.has("openingHours"),
    showGwadaFooter: enabled.has("gwadaFooter"),
    showGwadaFavicon: enabled.has("gwadaFavicon"),
    showQrCode: enabled.has("qrCode"),
  };
}
