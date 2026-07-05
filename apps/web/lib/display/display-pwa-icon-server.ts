import "server-only";

import sharp from "sharp";
import { loadPlatformFaviconAsset } from "@/lib/platform/platform-favicon-server";
import type { DisplayPwaIconSize } from "@/lib/display/display-pwa-config";
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

async function fallbackDisplayPwaIcon(size: DisplayPwaIconSize): Promise<Buffer> {
  const { r, g, b } = hexToRgb(DEFAULT_ACCENT_HEX);
  const radius = Math.round(size * 0.22);
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${radius}" fill="rgb(${r},${g},${b})"/>
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="system-ui, sans-serif"
        font-size="${Math.round(size * 0.34)}"
        font-weight="700"
        fill="#ffffff"
      >D</text>
    </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderDisplayPwaIcon(size: DisplayPwaIconSize): Promise<Buffer> {
  const asset = await loadPlatformFaviconAsset();
  if (!asset) {
    return fallbackDisplayPwaIcon(size);
  }

  try {
    const padding = Math.round(size * 0.12);
    const inner = size - padding * 2;
    return sharp(Buffer.from(asset.body))
      .resize(inner, inner, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();
  } catch {
    return fallbackDisplayPwaIcon(size);
  }
}
