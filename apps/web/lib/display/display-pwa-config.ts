/** PWA für /display (Küchen-/Service-Display). Dashboard: siehe dashboard-pwa-config. */

export const DISPLAY_PWA_SCOPE = "/display/";
/** Fallback, wenn kein Restaurant-Slug bekannt ist (Kopplungsseite). */
export const DISPLAY_PWA_PAIR_START_URL = "/display/pair";
/** @deprecated Nutze {@link displayPwaStartUrl} — bleibt für Pair-Fallback. */
export const DISPLAY_PWA_START_URL = DISPLAY_PWA_PAIR_START_URL;
export const DISPLAY_PWA_MANIFEST_PATH = "/display/manifest.webmanifest";
export const DISPLAY_PWA_SW_PATH = "/display/sw.js";

const DISPLAY_PWA_RESERVED_SEGMENTS = new Set(["pair", "icon"]);

/** Restaurant-Slug für Display-PWA (nicht Pair/Icon-Routen). */
export function normalizeDisplayPwaRestaurantSlug(
  slug: string | null | undefined,
): string | null {
  if (!slug?.trim()) return null;
  const normalized = slug.trim().toLowerCase();
  if (DISPLAY_PWA_RESERVED_SEGMENTS.has(normalized)) return null;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(normalized)) return null;
  return normalized;
}

export function displayPwaStartUrl(slug?: string | null): string {
  const normalized = normalizeDisplayPwaRestaurantSlug(slug);
  return normalized ? `/display/${normalized}` : DISPLAY_PWA_PAIR_START_URL;
}

export function displayPwaManifestPath(slug?: string | null): string {
  const normalized = normalizeDisplayPwaRestaurantSlug(slug);
  if (!normalized) return DISPLAY_PWA_MANIFEST_PATH;
  return `${DISPLAY_PWA_MANIFEST_PATH}?slug=${encodeURIComponent(normalized)}`;
}

export function displayPwaManifestId(slug?: string | null): string {
  return `${displayPwaStartUrl(slug)}/`;
}

export const DISPLAY_PWA_ICON_SIZES = [180, 192, 512] as const;

export type DisplayPwaIconSize = (typeof DISPLAY_PWA_ICON_SIZES)[number];

export function isDisplayPwaIconSize(value: number): value is DisplayPwaIconSize {
  return (DISPLAY_PWA_ICON_SIZES as readonly number[]).includes(value);
}

export function displayPwaIconPath(size: DisplayPwaIconSize): string {
  return `/display/icon/${size}`;
}
