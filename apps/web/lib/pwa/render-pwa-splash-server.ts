import "server-only";

import sharp from "sharp";
import { loadPlatformFaviconAsset } from "@/lib/platform/platform-favicon-server";
import { PWA_SPLASH_BACKGROUND_HEX } from "@/lib/pwa/apple-startup-images";

function letterSvg(size: number, letter: string): string {
  const radius = Math.round(size * 0.22);
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" fill="#f4f4f5"/>
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="system-ui, sans-serif"
        font-size="${Math.round(size * 0.34)}"
        font-weight="700"
        fill="#71717a"
      >${letter}</text>
    </svg>`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "");
  const n = Number.parseInt(raw, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Native iOS Launch Image: Vollbild mit Manifest-Hintergrundfarbe,
 * zentriert das Plattform-Favicon (kein Client-Overlay).
 */
export async function renderPwaSplashServer(
  width: number,
  height: number,
  fallbackLetter: "D" | "G",
): Promise<Buffer> {
  const bg = hexToRgb(PWA_SPLASH_BACKGROUND_HEX);
  const logoSize = Math.round(Math.min(width, height) * 0.22);
  const asset = await loadPlatformFaviconAsset();

  let logo: Buffer;
  if (!asset) {
    logo = await sharp(Buffer.from(letterSvg(logoSize, fallbackLetter)))
      .png()
      .toBuffer();
  } else {
    try {
      logo = await sharp(Buffer.from(asset.body))
        .resize(logoSize, logoSize, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
    } catch {
      logo = await sharp(Buffer.from(letterSvg(logoSize, fallbackLetter)))
        .png()
        .toBuffer();
    }
  }

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: bg,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}
