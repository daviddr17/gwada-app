/** PWA / lock targets for guest kiosk (iPad table + Android counter). */

export const KIOSK_PWA_SCOPE = "/kiosk/";
export const KIOSK_PWA_MANIFEST_PATH = "/kiosk/manifest.webmanifest";

export function kioskPwaStartUrl(slug: string): string {
  return `/kiosk/${encodeURIComponent(slug.trim().toLowerCase())}`;
}

export function kioskPwaManifestPath(slug?: string | null): string {
  if (!slug?.trim()) return KIOSK_PWA_MANIFEST_PATH;
  return `${KIOSK_PWA_MANIFEST_PATH}?slug=${encodeURIComponent(slug.trim().toLowerCase())}`;
}
