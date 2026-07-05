/** PWA nur für /display — Dashboard bleibt vorerst ohne Install. */

export const DISPLAY_PWA_SCOPE = "/display/";
export const DISPLAY_PWA_START_URL = "/display/pair";
export const DISPLAY_PWA_MANIFEST_PATH = "/display/manifest.webmanifest";
export const DISPLAY_PWA_SW_PATH = "/display/sw.js";

export const DISPLAY_PWA_ICON_SIZES = [180, 192, 512] as const;

export type DisplayPwaIconSize = (typeof DISPLAY_PWA_ICON_SIZES)[number];

export function isDisplayPwaIconSize(value: number): value is DisplayPwaIconSize {
  return (DISPLAY_PWA_ICON_SIZES as readonly number[]).includes(value);
}

export function displayPwaIconPath(size: DisplayPwaIconSize): string {
  return `/display/icon/${size}`;
}
