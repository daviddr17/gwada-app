import "server-only";

import sharp from "sharp";
import { loadPlatformFaviconAsset } from "@/lib/platform/platform-favicon-server";

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

/** PWA-Manifest / iOS Launch: nur Favicon, ohne Akzent-Kachel. */
export async function renderPwaIconServer(
  size: number,
  fallbackLetter: "D" | "G",
): Promise<Buffer> {
  const asset = await loadPlatformFaviconAsset();

  if (!asset) {
    return sharp(Buffer.from(letterSvg(size, fallbackLetter))).png().toBuffer();
  }

  try {
    const inner = Math.round(size * (size >= 512 ? 0.82 : 0.88));
    const logo = await sharp(Buffer.from(asset.body))
      .resize(inner, inner, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toBuffer();
  } catch {
    return sharp(Buffer.from(letterSvg(size, fallbackLetter))).png().toBuffer();
  }
}
