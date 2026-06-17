/** Widgets mit öffentlicher Einbindung (iframe / gwada.js). */
export type EmbedAppearanceWidget =
  | "opening_hours"
  | "menu"
  | "reviews"
  | "news"
  | "reservation"
  | "gallery";

/** Helle Schrift auf dunklem Host-Hintergrund vs. dunkle Schrift auf hellem Hintergrund. */
export type EmbedTextTheme = "light" | "dark";

export const DEFAULT_EMBED_TEXT_THEME: EmbedTextTheme = "dark";

export function parseEmbedTextTheme(
  raw: string | null | undefined,
): EmbedTextTheme {
  return raw === "light" ? "light" : "dark";
}

/** Nur für Admin-Vorschau — überschreibt gespeichertes Theme pro iframe. */
export const EMBED_PREVIEW_TEXT_THEME_PARAM = "gwada_preview_text_theme";

export function parseEmbedPreviewTextThemeOverride(
  raw: string | null | undefined,
): EmbedTextTheme | null {
  if (raw === "light" || raw === "dark") return raw;
  return null;
}

export function resolveEmbedTextTheme(
  stored: EmbedTextTheme,
  previewOverride: string | null | undefined,
): EmbedTextTheme {
  return parseEmbedPreviewTextThemeOverride(previewOverride) ?? stored;
}

export function parseEmbedAppearanceWidget(
  raw: string | null | undefined,
): EmbedAppearanceWidget | null {
  const id = raw?.trim();
  if (
    id === "opening_hours" ||
    id === "menu" ||
    id === "reviews" ||
    id === "news" ||
    id === "reservation" ||
    id === "gallery"
  ) {
    return id;
  }
  return null;
}
