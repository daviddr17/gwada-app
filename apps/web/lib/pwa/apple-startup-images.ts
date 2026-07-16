/**
 * Native iOS PWA Launch Screens (`apple-touch-startup-image`).
 * Pixelgrößen + Media-Queries aus pwa-asset-generator / Apple-Doku.
 * Manifest-Icons reichen auf iOS nicht — ohne diese Links kein Splash.
 */

export const PWA_SPLASH_BACKGROUND_HEX = "#ffffff";

export type AppleStartupImageSpec = {
  width: number;
  height: number;
  media: string;
};

/** Vollständige Geräte-Matrix (Portrait + Landscape). */
export const APPLE_STARTUP_IMAGES: readonly AppleStartupImageSpec[] = [
  {
    width: 2048,
    height: 2732,
    media:
      "screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 2732,
    height: 2048,
    media:
      "screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 1668,
    height: 2388,
    media:
      "screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 2388,
    height: 1668,
    media:
      "screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 1668,
    height: 2224,
    media:
      "screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 2224,
    height: 1668,
    media:
      "screen and (device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 1536,
    height: 2048,
    media:
      "screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 2048,
    height: 1536,
    media:
      "screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 1640,
    height: 2360,
    media:
      "screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 2360,
    height: 1640,
    media:
      "screen and (device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 1620,
    height: 2160,
    media:
      "screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 2160,
    height: 1620,
    media:
      "screen and (device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 1488,
    height: 2266,
    media:
      "screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 2266,
    height: 1488,
    media:
      "screen and (device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 1320,
    height: 2868,
    media:
      "screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2868,
    height: 1320,
    media:
      "screen and (device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 1206,
    height: 2622,
    media:
      "screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2622,
    height: 1206,
    media:
      "screen and (device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 1290,
    height: 2796,
    media:
      "screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2796,
    height: 1290,
    media:
      "screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 1179,
    height: 2556,
    media:
      "screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2556,
    height: 1179,
    media:
      "screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 1284,
    height: 2778,
    media:
      "screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2778,
    height: 1284,
    media:
      "screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 1170,
    height: 2532,
    media:
      "screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2532,
    height: 1170,
    media:
      "screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 1125,
    height: 2436,
    media:
      "screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2436,
    height: 1125,
    media:
      "screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 1242,
    height: 2688,
    media:
      "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2688,
    height: 1242,
    media:
      "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 828,
    height: 1792,
    media:
      "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 1792,
    height: 828,
    media:
      "screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 1242,
    height: 2208,
    media:
      "screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    width: 2208,
    height: 1242,
    media:
      "screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)",
  },
  {
    width: 750,
    height: 1334,
    media:
      "screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 1334,
    height: 750,
    media:
      "screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
  {
    width: 640,
    height: 1136,
    media:
      "screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    width: 1136,
    height: 640,
    media:
      "screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)",
  },
] as const;

const STARTUP_SIZE_KEYS = new Set(
  APPLE_STARTUP_IMAGES.map((s) => `${s.width}x${s.height}`),
);

export function isAppleStartupImageSizeKey(value: string): boolean {
  return STARTUP_SIZE_KEYS.has(value);
}

export function parseAppleStartupImageSize(
  value: string,
): { width: number; height: number } | null {
  if (!isAppleStartupImageSizeKey(value)) return null;
  const [w, h] = value.split("x");
  const width = Number.parseInt(w ?? "", 10);
  const height = Number.parseInt(h ?? "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

/** Next `appleWebApp.startupImage` Einträge für Layout-Metadata. */
export function appleWebAppStartupImageMetadata(
  splashPathPrefix: string,
): Array<{ url: string; media: string }> {
  const base = splashPathPrefix.replace(/\/$/, "");
  return APPLE_STARTUP_IMAGES.map(({ width, height, media }) => ({
    url: `${base}/${width}x${height}`,
    media,
  }));
}

/**
 * Next 15+ mappt `appleWebApp.capable` auf `mobile-web-app-capable`.
 * iOS Splash braucht weiterhin das deprecated Meta-Tag.
 * @see https://github.com/vercel/next.js/issues/74524
 */
export const APPLE_MOBILE_WEB_APP_CAPABLE_META = {
  "apple-mobile-web-app-capable": "yes",
} as const;
