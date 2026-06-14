import "server-only";

import sharp from "sharp";

/** Hero-Anzeige: max ~10rem × h-12 — 240px @2x reicht für LCP. */
export const MARKETING_LOGO_WIDTH = 240;
export const MARKETING_LOGO_MAX_HEIGHT = 96;

/** Allgemeine Logo-Nutzung (App-Chrome, E-Mails): nicht 2000px breit speichern. */
export const STORED_LOGO_MAX_WIDTH = 480;

export async function optimizeLogoBufferForMarketing(
  input: Buffer,
): Promise<Buffer> {
  return sharp(input, { animated: false })
    .rotate()
    .resize(MARKETING_LOGO_WIDTH, MARKETING_LOGO_MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 86, effort: 4 })
    .toBuffer();
}

export async function optimizeLogoBufferForStorage(
  input: Buffer,
): Promise<{ buffer: Buffer; contentType: "image/webp" }> {
  const buffer = await sharp(input, { animated: false })
    .rotate()
    .resize(STORED_LOGO_MAX_WIDTH, STORED_LOGO_MAX_WIDTH, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 88, alphaQuality: 90 })
    .toBuffer();
  return { buffer, contentType: "image/webp" };
}

export function isSvgLogoMime(mime: string): boolean {
  return mime === "image/svg+xml";
}
