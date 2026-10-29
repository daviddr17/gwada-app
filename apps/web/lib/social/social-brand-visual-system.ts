/** Mirrors SocialStylePreset — kept local to avoid brand-kit ↔ visual-system cycles. */
export type SocialVisualStylePreset =
  | "schlicht"
  | "modern"
  | "warm"
  | "fancy"
  | "fein";

/**
 * Restaurant display typeface for KI-Post creatives (Sharp SVG @font-face).
 * Curated to files available on render hosts (Inter / Public Sans / Noto / Croscore).
 */
export const SOCIAL_DISPLAY_FONTS = [
  "inter",
  "public_sans",
  "noto_serif",
  "tinos",
  "arimo",
] as const;

export type SocialDisplayFontId = (typeof SOCIAL_DISPLAY_FONTS)[number];

export const SOCIAL_DISPLAY_FONT_LABELS: Record<SocialDisplayFontId, string> = {
  inter: "Inter",
  public_sans: "Public Sans",
  noto_serif: "Noto Serif",
  tinos: "Tinos",
  arimo: "Arimo",
};

export const SOCIAL_DISPLAY_FONT_HINTS: Record<SocialDisplayFontId, string> = {
  inter: "Modern und klar — Alltags-Gastro.",
  public_sans: "Editorial-Sans, etwas weicher.",
  noto_serif: "Klassische Serife — Abendkarte & Fine Dining.",
  tinos: "Traditionell, Times-ähnlich.",
  arimo: "Geometrisch-neutral.",
};

/** Browser-Preview-Stacks (Annäherung; Server rendert echte Dateien). */
export const SOCIAL_DISPLAY_FONT_CSS: Record<SocialDisplayFontId, string> = {
  inter: 'Inter, ui-sans-serif, system-ui, sans-serif',
  public_sans: '"Public Sans", ui-sans-serif, system-ui, sans-serif',
  noto_serif: '"Noto Serif", Georgia, "Times New Roman", serif',
  tinos: 'Tinos, Georgia, "Times New Roman", serif',
  arimo: 'Arimo, Arial, Helvetica, sans-serif',
};

export function isSocialDisplayFontSerif(font: SocialDisplayFontId): boolean {
  return font === "noto_serif" || font === "tinos";
}

export const SOCIAL_STYLE_PRESET_LABELS: Record<
  SocialVisualStylePreset,
  string
> = {
  schlicht: "Schlicht",
  modern: "Modern",
  warm: "Warm",
  fancy: "Fancy",
  fein: "Fein",
};

export const SOCIAL_STYLE_PRESET_HINTS: Record<SocialVisualStylePreset, string> =
  {
    schlicht: "Wenig Linien, klare Akzente.",
    modern: "Geometrische Formen, harte Kanten.",
    warm: "Weiche Pinselstriche und organische Formen.",
    fancy: "Ornamente, Doppelregeln, Diamanten.",
    fein: "Hauchdünne Linien, zurückhaltend.",
  };

export function defaultDisplayFontForStyle(
  style: SocialVisualStylePreset,
): SocialDisplayFontId {
  switch (style) {
    case "modern":
      return "public_sans";
    case "schlicht":
      return "inter";
    case "fancy":
      return "tinos";
    case "warm":
    case "fein":
    default:
      return "noto_serif";
  }
}

export function parseSocialDisplayFont(
  raw: unknown,
  styleFallback?: SocialVisualStylePreset,
): SocialDisplayFontId {
  if (
    typeof raw === "string" &&
    SOCIAL_DISPLAY_FONTS.includes(raw as SocialDisplayFontId)
  ) {
    return raw as SocialDisplayFontId;
  }
  return defaultDisplayFontForStyle(styleFallback ?? "schlicht");
}

export type BrandMotifPlacement =
  | "editorial_rule"
  | "atelier_bar"
  | "soiree_rule"
  | "signature_rule";

/**
 * Accent strokes / shapes from brand palette + stylePreset.
 * Colors must already be XML-safe hex (no raw user strings).
 */
export function brandMotifSvg(params: {
  stylePreset: SocialVisualStylePreset;
  accent: string;
  secondary: string;
  placement: BrandMotifPlacement;
}): string {
  const { stylePreset, accent, secondary, placement } = params;

  if (placement === "editorial_rule") {
    return editorialRuleMotif(stylePreset, accent, secondary);
  }
  if (placement === "atelier_bar") {
    return atelierBarMotif(stylePreset, accent, secondary);
  }
  if (placement === "soiree_rule") {
    return soireeRuleMotif(stylePreset, accent, secondary);
  }
  return signatureRuleMotif(stylePreset, accent, secondary);
}

/** Soirée outer frame — style changes stroke weight / corner ornaments. */
export function brandSoireeFrameSvg(params: {
  stylePreset: SocialVisualStylePreset;
  accent: string;
  secondary: string;
}): string {
  const { stylePreset, accent, secondary } = params;
  if (stylePreset === "modern") {
    return `
  <rect x="48" y="48" width="984" height="984" fill="none" stroke="${accent}" stroke-width="3"/>
  <rect x="48" y="48" width="28" height="3" fill="${accent}"/>
  <rect x="48" y="48" width="3" height="28" fill="${accent}"/>
  <rect x="1004" y="48" width="28" height="3" fill="${secondary}" transform="rotate(180 1018 49.5)"/>
  <rect x="1029" y="48" width="3" height="28" fill="${secondary}"/>
  <rect x="48" y="1029" width="28" height="3" fill="${secondary}"/>
  <rect x="48" y="1004" width="3" height="28" fill="${accent}"/>
  <rect x="1004" y="1029" width="28" height="3" fill="${accent}"/>
  <rect x="1029" y="1004" width="3" height="28" fill="${accent}"/>`;
  }
  if (stylePreset === "warm") {
    return `
  <rect x="56" y="56" width="968" height="968" rx="18" fill="none" stroke="${accent}" stroke-opacity="0.75" stroke-width="2"/>
  <path d="M120 72 C200 58 280 86 360 72" fill="none" stroke="${secondary}" stroke-opacity="0.55" stroke-width="3" stroke-linecap="round"/>
  <path d="M720 1008 C800 992 880 1016 960 1000" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  if (stylePreset === "fancy") {
    return `
  <rect x="52" y="52" width="976" height="976" fill="none" stroke="${accent}" stroke-opacity="0.9" stroke-width="1.5"/>
  <rect x="68" y="68" width="944" height="944" fill="none" stroke="${secondary}" stroke-opacity="0.35" stroke-width="1"/>
  <path d="M540 40 L552 58 L540 76 L528 58 Z" fill="${accent}"/>
  <path d="M540 1004 L552 1022 L540 1040 L528 1022 Z" fill="${accent}" transform="translate(0 -36)"/>
  <path d="M40 540 L58 552 L76 540 L58 528 Z" fill="${secondary}" fill-opacity="0.8"/>
  <path d="M1004 540 L1022 552 L1040 540 L1022 528 Z" fill="${secondary}" fill-opacity="0.8" transform="translate(-36 0)"/>`;
  }
  if (stylePreset === "fein") {
    return `
  <rect x="56" y="56" width="968" height="968" fill="none" stroke="${accent}" stroke-opacity="0.7" stroke-width="0.75"/>
  <rect x="72" y="72" width="936" height="936" fill="none" stroke="${secondary}" stroke-opacity="0.25" stroke-width="0.6"/>`;
  }
  // schlicht
  return `
  <rect x="52" y="52" width="976" height="976" fill="none" stroke="${accent}" stroke-opacity="0.85" stroke-width="1.5"/>
  <rect x="68" y="68" width="944" height="944" fill="none" stroke="${secondary}" stroke-opacity="0.3" stroke-width="1"/>`;
}

function editorialRuleMotif(
  style: SocialVisualStylePreset,
  accent: string,
  secondary: string,
): string {
  const y = 758;
  if (style === "modern") {
    return `
  <rect x="64" y="${y}" width="64" height="4" fill="${accent}"/>
  <rect x="136" y="${y - 6}" width="14" height="14" fill="${secondary}" fill-opacity="0.85"/>
  <rect x="64" y="64" width="22" height="2.5" fill="${accent}" fill-opacity="0.7"/>
  <rect x="64" y="64" width="2.5" height="22" fill="${accent}" fill-opacity="0.7"/>`;
  }
  if (style === "warm") {
    return `
  <path d="M64 ${y + 2} C96 ${y - 10} 128 ${y + 14} 168 ${y - 2} S220 ${y + 8} 248 ${y}" fill="none" stroke="${accent}" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="268" cy="${y}" r="5" fill="${secondary}" fill-opacity="0.75"/>
  <path d="M900 80 C940 60 980 100 1000 70" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2" stroke-linecap="round"/>`;
  }
  if (style === "fancy") {
    return `
  <rect x="64" y="${y + 0.5}" width="36" height="1.25" fill="${accent}"/>
  <path d="M112 ${y + 1} L120 ${y - 7} L128 ${y + 1} L120 ${y + 9} Z" fill="${accent}"/>
  <rect x="132" y="${y + 0.5}" width="36" height="1.25" fill="${secondary}" fill-opacity="0.8"/>
  <rect x="64" y="${y + 8}" width="104" height="0.6" fill="${accent}" fill-opacity="0.35"/>`;
  }
  if (style === "fein") {
    return `
  <rect x="64" y="${y + 1}" width="56" height="0.9" fill="${accent}"/>
  <rect x="64" y="${y - 2}" width="0.9" height="6" fill="${accent}"/>
  <rect x="119" y="${y - 2}" width="0.9" height="6" fill="${accent}"/>
  <rect x="128" y="${y + 1}" width="18" height="0.9" fill="${secondary}" fill-opacity="0.55"/>`;
  }
  return `
  <rect x="64" y="${y}" width="42" height="2.5" fill="${accent}"/>
  <rect x="112" y="${y}" width="14" height="2.5" fill="${secondary}" fill-opacity="0.7"/>`;
}

function atelierBarMotif(
  style: SocialVisualStylePreset,
  accent: string,
  secondary: string,
): string {
  if (style === "modern") {
    return `
  <rect x="64" y="__Y__" width="72" height="4" fill="${accent}"/>
  <rect x="144" y="__Y__" width="4" height="18" fill="${secondary}" fill-opacity="0.8"/>`;
  }
  if (style === "warm") {
    return `
  <path d="M64 __Y2__ C110 __Y_UP__ 150 __Y_DN__ 210 __Y2__" fill="none" stroke="${accent}" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="228" cy="__Y2__" r="4.5" fill="${secondary}" fill-opacity="0.7"/>`;
  }
  if (style === "fancy") {
    return `
  <rect x="64" y="__Y1__" width="28" height="1.2" fill="${accent}"/>
  <path d="M100 __Y2__ L108 __Y_UP__ L116 __Y2__ L108 __Y_DN__ Z" fill="${accent}"/>
  <rect x="124" y="__Y1__" width="28" height="1.2" fill="${secondary}" fill-opacity="0.75"/>`;
  }
  if (style === "fein") {
    return `
  <rect x="64" y="__Y1__" width="48" height="0.85" fill="${accent}"/>
  <rect x="64" y="__Y_TICK__" width="0.85" height="5" fill="${accent}"/>
  <rect x="111" y="__Y_TICK__" width="0.85" height="5" fill="${accent}"/>`;
  }
  return `
  <rect x="64" y="__Y__" width="56" height="3" fill="${accent}"/>`;
}

/** Resolve atelier motif placeholders for a given panel top. */
export function brandAtelierBarMotifAt(
  stylePreset: SocialVisualStylePreset,
  accent: string,
  secondary: string,
  panelTop: number,
): string {
  const y = panelTop;
  return atelierBarMotif(stylePreset, accent, secondary)
    .replaceAll("__Y__", String(y))
    .replaceAll("__Y1__", String(y + 1))
    .replaceAll("__Y2__", String(y + 2))
    .replaceAll("__Y_UP__", String(y - 8))
    .replaceAll("__Y_DN__", String(y + 10))
    .replaceAll("__Y_TICK__", String(y - 2));
}

function soireeRuleMotif(
  style: SocialVisualStylePreset,
  accent: string,
  secondary: string,
): string {
  // Caller injects y via __RULE_Y__
  if (style === "modern") {
    return `
  <rect x="492" y="__RULE_Y__" width="96" height="3" fill="${accent}"/>
  <rect x="534" y="__RULE_Y_UP__" width="12" height="12" fill="${secondary}" fill-opacity="0.8"/>`;
  }
  if (style === "warm") {
    return `
  <path d="M470 __RULE_Y2__ C500 __RULE_Y_UP__ 540 __RULE_Y_DN__ 610 __RULE_Y2__" fill="none" stroke="${accent}" stroke-width="2.8" stroke-linecap="round"/>
  <circle cx="540" cy="__RULE_Y2__" r="4" fill="${secondary}" fill-opacity="0.75"/>`;
  }
  if (style === "fancy") {
    return `
  <rect x="470" y="__RULE_Y1__" width="50" height="1.1" fill="${accent}"/>
  <path d="M540 __RULE_Y2__ L548 __RULE_Y_UP__ L556 __RULE_Y2__ L548 __RULE_Y_DN__ Z" fill="${accent}"/>
  <rect x="560" y="__RULE_Y1__" width="50" height="1.1" fill="${secondary}" fill-opacity="0.75"/>`;
  }
  if (style === "fein") {
    return `
  <rect x="492" y="__RULE_Y1__" width="96" height="0.85" fill="${accent}"/>
  <rect x="492" y="__RULE_Y_TICK__" width="0.85" height="5" fill="${accent}"/>
  <rect x="587" y="__RULE_Y_TICK__" width="0.85" height="5" fill="${accent}"/>`;
  }
  return `
  <rect x="492" y="__RULE_Y__" width="96" height="1.5" fill="${accent}"/>`;
}

export function brandSoireeRuleMotifAt(
  stylePreset: SocialVisualStylePreset,
  accent: string,
  secondary: string,
  ruleY: number,
): string {
  return soireeRuleMotif(stylePreset, accent, secondary)
    .replaceAll("__RULE_Y__", String(ruleY))
    .replaceAll("__RULE_Y1__", String(ruleY + 0.5))
    .replaceAll("__RULE_Y2__", String(ruleY + 1))
    .replaceAll("__RULE_Y_UP__", String(ruleY - 7))
    .replaceAll("__RULE_Y_DN__", String(ruleY + 9))
    .replaceAll("__RULE_Y_TICK__", String(ruleY - 2));
}

function signatureRuleMotif(
  style: SocialVisualStylePreset,
  accent: string,
  secondary: string,
): string {
  const y = 498;
  if (style === "modern") {
    return `
  <rect x="474" y="${y}" width="132" height="3.5" fill="${accent}"/>
  <rect x="606" y="${y - 5}" width="12" height="12" fill="${secondary}" fill-opacity="0.8"/>`;
  }
  if (style === "warm") {
    return `
  <path d="M460 ${y + 2} C500 ${y - 10} 540 ${y + 12} 620 ${y}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
  <circle cx="636" cy="${y + 1}" r="4.5" fill="${secondary}" fill-opacity="0.7"/>`;
  }
  if (style === "fancy") {
    return `
  <rect x="460" y="${y + 0.5}" width="56" height="1.2" fill="${accent}"/>
  <path d="M540 ${y + 1} L548 ${y - 7} L556 ${y + 1} L548 ${y + 9} Z" fill="${accent}"/>
  <rect x="564" y="${y + 0.5}" width="56" height="1.2" fill="${secondary}" fill-opacity="0.75"/>`;
  }
  if (style === "fein") {
    return `
  <rect x="486" y="${y + 1}" width="108" height="0.85" fill="${accent}"/>
  <rect x="486" y="${y - 2}" width="0.85" height="5" fill="${accent}"/>
  <rect x="593" y="${y - 2}" width="0.85" height="5" fill="${accent}"/>`;
  }
  return `
  <rect x="486" y="${y}" width="108" height="2" fill="${accent}"/>`;
}

/** Preview helper: small motif as inline SVG for React (same language as server). */
export function brandMotifPreviewSvg(params: {
  stylePreset: SocialVisualStylePreset;
  accent: string;
  secondary: string;
  width?: number;
  height?: number;
}): string {
  const w = params.width ?? 120;
  const h = params.height ?? 16;
  const a = params.accent;
  const s = params.secondary;
  const style = params.stylePreset;
  if (style === "modern") {
    return `<svg width="${w}" height="${h}" viewBox="0 0 120 16" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="6" width="72" height="4" fill="${a}"/><rect x="80" y="2" width="12" height="12" fill="${s}" fill-opacity="0.85"/></svg>`;
  }
  if (style === "warm") {
    return `<svg width="${w}" height="${h}" viewBox="0 0 120 16" xmlns="http://www.w3.org/2000/svg"><path d="M2 8 C30 0 50 16 78 6 S110 12 118 8" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round"/><circle cx="112" cy="8" r="3.5" fill="${s}" fill-opacity="0.75"/></svg>`;
  }
  if (style === "fancy") {
    return `<svg width="${w}" height="${h}" viewBox="0 0 120 16" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="7.5" width="40" height="1.2" fill="${a}"/><path d="M52 8 L58 2 L64 8 L58 14 Z" fill="${a}"/><rect x="72" y="7.5" width="40" height="1.2" fill="${s}" fill-opacity="0.8"/></svg>`;
  }
  if (style === "fein") {
    return `<svg width="${w}" height="${h}" viewBox="0 0 120 16" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="7.5" width="100" height="0.9" fill="${a}"/><rect x="0" y="5" width="0.9" height="6" fill="${a}"/><rect x="99" y="5" width="0.9" height="6" fill="${a}"/></svg>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 120 16" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="6.5" width="48" height="2.5" fill="${a}"/><rect x="56" y="6.5" width="16" height="2.5" fill="${s}" fill-opacity="0.7"/></svg>`;
}
