import "server-only";

import sharp from "sharp";
import { loadPlatformFaviconAsset } from "@/lib/platform/platform-favicon-server";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex) ?? DEFAULT_ACCENT_HEX;
  const value = normalized.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function roundedSquareSvg(size: number, rgb: { r: number; g: number; b: number }): string {
  const radius = Math.round(size * 0.22);
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" fill="rgb(${rgb.r},${rgb.g},${rgb.b})"/>
    </svg>`;
}

function letterSvg(
  size: number,
  letter: string,
  rgb: { r: number; g: number; b: number },
): string {
  const radius = Math.round(size * 0.22);
  return `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" fill="rgb(${rgb.r},${rgb.g},${rgb.b})"/>
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="system-ui, sans-serif"
        font-size="${Math.round(size * 0.34)}"
        font-weight="700"
        fill="#ffffff"
      >${letter}</text>
    </svg>`;
}

/** Vollflächiges Icon auf Akzent-Kachel — kein weißer Rand (iOS Launch / Splash). */
export async function renderPwaIconServer(
  size: number,
  fallbackLetter: "D" | "G",
): Promise<Buffer> {
  const rgb = hexToRgb(DEFAULT_ACCENT_HEX);
  const asset = await loadPlatformFaviconAsset();

  if (!asset) {
    return sharp(Buffer.from(letterSvg(size, fallbackLetter, rgb))).png().toBuffer();
  }

  try {
    const inner = Math.round(size * (size >= 512 ? 0.52 : 0.58));
    const logo = await sharp(Buffer.from(asset.body))
      .resize(inner, inner, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    return sharp(Buffer.from(roundedSquareSvg(size, rgb)))
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toBuffer();
  } catch {
    return sharp(Buffer.from(letterSvg(size, fallbackLetter, rgb))).png().toBuffer();
  }
}
