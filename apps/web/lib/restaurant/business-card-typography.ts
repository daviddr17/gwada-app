export type BusinessCardTypographyId = "modern" | "classic" | "elegant";

export type BusinessCardTypography = {
  id: BusinessCardTypographyId;
  label: string;
  headingFamily: string;
  bodyFamily: string;
  /** Multiplikator für Namens-Schrift (Basis 0.42). */
  nameScale: number;
  nameWeight: number;
  nameTracking: string;
};

export const BUSINESS_CARD_TYPOGRAPHY: Record<
  BusinessCardTypographyId,
  BusinessCardTypography
> = {
  modern: {
    id: "modern",
    label: "Modern",
    headingFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
    bodyFamily: "var(--font-sans), system-ui, -apple-system, sans-serif",
    nameScale: 1.02,
    nameWeight: 600,
    nameTracking: "-0.032em",
  },
  classic: {
    id: "classic",
    label: "Klassisch",
    headingFamily: '"Libre Baskerville", Georgia, "Times New Roman", serif',
    bodyFamily: '"Libre Baskerville", Georgia, "Times New Roman", serif',
    nameScale: 0.96,
    nameWeight: 600,
    nameTracking: "-0.012em",
  },
  elegant: {
    id: "elegant",
    label: "Elegant",
    headingFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
    bodyFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
    nameScale: 0.94,
    nameWeight: 500,
    nameTracking: "0.01em",
  },
};

export const BUSINESS_CARD_TYPOGRAPHY_OPTIONS = Object.values(BUSINESS_CARD_TYPOGRAPHY);

export function businessCardTypography(
  id: BusinessCardTypographyId | undefined,
): BusinessCardTypography {
  return BUSINESS_CARD_TYPOGRAPHY[id ?? "modern"] ?? BUSINESS_CARD_TYPOGRAPHY.modern;
}

const CANVAS_EXPORT_SANS_STACK =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const CANVAS_EXPORT_SERIF_STACK = 'Georgia, "Times New Roman", Times, serif';

/** System-Schriften für html2canvas — Google/Next-Fonts tainten den Canvas. */
export function businessCardFontFamilyForCanvasExport(
  typographyId: BusinessCardTypographyId,
  _kind: "heading" | "body",
): string {
  if (typographyId === "modern") {
    return CANVAS_EXPORT_SANS_STACK;
  }
  return CANVAS_EXPORT_SERIF_STACK;
}

export function isCanvasUnsafeFontFamily(fontFamily: string): boolean {
  const value = fontFamily.toLowerCase();
  return (
    value.includes("libre baskerville")
    || value.includes("playfair display")
    || value.includes("var(--font-sans)")
    || value.includes("fonts.googleapis")
  );
}

/** Google Fonts für Classic + Elegant (Modern = DM Sans aus App-Layout). */
export const BUSINESS_CARD_GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;600;700&family=Playfair+Display:wght@400;500;600&display=swap";
