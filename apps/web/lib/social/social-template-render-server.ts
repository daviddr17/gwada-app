import "server-only";

import { randomUUID } from "crypto";
import { existsSync } from "fs";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NEWS_MEDIA_BUCKET } from "@/lib/news/news-media";
import type {
  SocialStylePreset,
  SocialTemplateId,
} from "@/lib/social/social-brand-kit";
import {
  DEFAULT_SOCIAL_FEED_PALETTE,
  type SocialFeedLayoutId,
  type SocialFeedPalette,
  type SocialPhotoLook,
} from "@/lib/social/social-feed-brand-system";
import { overlayLineFromCaption } from "@/lib/social/social-caption-templates";
import { loadSocialImageBuffer } from "@/lib/social/social-asset-resolve-server";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

const SIZE = 1080;
const LOGO_MARK_SIZE = 72;

const FONT_INTER =
  "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf";
const FONT_INTER_BOLD =
  "/usr/share/fonts/truetype/macos/Inter-Bold.ttf";
const FONT_INTER_REG =
  "/usr/share/fonts/truetype/macos/Inter-Regular.ttf";
const FONT_SERIF =
  "/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf";
const FONT_SERIF_REG =
  "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf";

function fontFaceCss(): string {
  const faces: Array<[string, string]> = [
    ["GwadaInter", FONT_INTER_REG],
    ["GwadaInterSemi", FONT_INTER],
    ["GwadaInterBold", FONT_INTER_BOLD],
    ["GwadaSerif", FONT_SERIF_REG],
    ["GwadaSerifBold", FONT_SERIF],
  ];
  return faces
    .filter(([, path]) => existsSync(path))
    .map(
      ([family, path]) =>
        `@font-face{font-family:'${family}';src:url('file://${path}');}`,
    )
    .join("");
}

type StyleTheme = {
  bg: string;
  fg: string;
  /** food_hero layout variant */
  heroVariant: "soft" | "modern" | "warm" | "fancy" | "fein";
  cardBg: string;
  cardFg: string;
};

const STYLE_THEMES: Record<SocialStylePreset, StyleTheme> = {
  schlicht: {
    bg: "#f4f4f5",
    fg: "#171717",
    heroVariant: "soft",
    cardBg: "#f4f4f5",
    cardFg: "#171717",
  },
  modern: {
    bg: "#0f172a",
    fg: "#f8fafc",
    heroVariant: "modern",
    cardBg: "#0f172a",
    cardFg: "#f8fafc",
  },
  warm: {
    bg: "#2a211c",
    fg: "#f7f0e8",
    heroVariant: "warm",
    cardBg: "#2a211c",
    cardFg: "#f7f0e8",
  },
  fancy: {
    bg: "#140f14",
    fg: "#faf5ff",
    heroVariant: "fancy",
    cardBg: "#140f14",
    cardFg: "#faf5ff",
  },
  fein: {
    bg: "#0a0a0a",
    fg: "#fafafa",
    heroVariant: "fein",
    cardBg: "#0a0a0a",
    cardFg: "#fafafa",
  },
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

function foodHeroOverlaySvg(params: {
  accent: string;
  restaurantName: string;
  title: string | null;
  captionLine: string;
  variant: StyleTheme["heroVariant"];
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 48));
  const title = params.title ? escapeXml(params.title.slice(0, 42)) : "";
  const captionLines = wrapLines(params.captionLine, 38, 2).map(escapeXml);
  const accent = escapeXml(params.accent);
  const css = fontFaceCss();

  let chrome = "";
  if (params.variant === "soft") {
    const captionY = title ? 930 : 900;
    const captions = captionLines
      .map(
        (line, i) =>
          `<text x="72" y="${captionY + i * 34}" fill="#ffffff" fill-opacity="0.9" font-size="26" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
      )
      .join("");
    chrome = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="55%" stop-color="#000" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.62"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <rect x="72" y="792" width="56" height="3" rx="1.5" fill="${accent}"/>
  <text x="72" y="838" fill="#ffffff" fill-opacity="0.78" font-size="18" letter-spacing="3.5" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  ${title ? `<text x="72" y="888" fill="#ffffff" font-size="44" font-family="GwadaInterBold, Helvetica, sans-serif">${title}</text>` : ""}
  ${captions}`;
  } else if (params.variant === "modern") {
    const captionY = title ? 918 : 888;
    const captions = captionLines
      .map(
        (line, i) =>
          `<text x="96" y="${captionY + i * 32}" fill="#ffffff" fill-opacity="0.88" font-size="24" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
      )
      .join("");
    chrome = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="50%" stop-color="#000" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <rect x="0" y="0" width="8" height="${SIZE}" fill="${accent}"/>
  <rect x="96" y="760" width="120" height="4" fill="${accent}"/>
  <text x="96" y="808" fill="#ffffff" fill-opacity="0.7" font-size="16" letter-spacing="5" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  ${title ? `<text x="96" y="868" fill="#ffffff" font-size="48" font-family="GwadaInterBold, Helvetica, sans-serif">${title}</text>` : ""}
  ${captions}`;
  } else if (params.variant === "warm") {
    const captionY = title ? 900 : 870;
    const captions = captionLines
      .map(
        (line, i) =>
          `<text x="88" y="${captionY + i * 32}" fill="#f7f0e8" fill-opacity="0.9" font-size="25" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
      )
      .join("");
    chrome = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a211c" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2a211c" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <rect x="56" y="720" width="968" height="304" rx="28" fill="#2a211c" fill-opacity="0.72"/>
  <rect x="88" y="756" width="72" height="6" rx="3" fill="${accent}"/>
  <text x="88" y="808" fill="#f7f0e8" fill-opacity="0.75" font-size="17" letter-spacing="3" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  ${title ? `<text x="88" y="860" fill="#f7f0e8" font-size="42" font-family="GwadaSerifBold, Georgia, serif">${title}</text>` : ""}
  ${captions}`;
  } else if (params.variant === "fancy") {
    const captionY = title ? 912 : 878;
    const captions = captionLines
      .map(
        (line, i) =>
          `<text x="100" y="${captionY + i * 30}" fill="#faf5ff" fill-opacity="0.88" font-size="23" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
      )
      .join("");
    chrome = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#140f14" stop-opacity="0.18"/>
      <stop offset="45%" stop-color="#140f14" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#140f14" stop-opacity="0.82"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1a1220" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#120c18" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <!-- feiner Doppelrahmen, großzügig eingerückt -->
  <rect x="36" y="36" width="1008" height="1008" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1"/>
  <rect x="44" y="44" width="992" height="992" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.5"/>
  <rect x="72" y="708" width="936" height="300" rx="8" fill="url(#panel)"/>
  <rect x="100" y="744" width="40" height="2" fill="${accent}"/>
  <text x="100" y="788" fill="#faf5ff" fill-opacity="0.72" font-size="15" letter-spacing="6" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  ${title ? `<text x="100" y="848" fill="#faf5ff" font-size="46" font-family="GwadaSerifBold, Georgia, serif">${title}</text>` : ""}
  ${captions}`;
  } else {
    // fein
    const captionY = title ? 920 : 890;
    const captions = captionLines
      .map(
        (line, i) =>
          `<text x="96" y="${captionY + i * 30}" fill="#ffffff" fill-opacity="0.72" font-size="22" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
      )
      .join("");
    chrome = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <rect x="48" y="48" width="984" height="984" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1"/>
  <rect x="96" y="792" width="32" height="1" fill="${accent}"/>
  <text x="96" y="836" fill="#ffffff" fill-opacity="0.55" font-size="14" letter-spacing="7" font-family="GwadaInter, Helvetica, sans-serif">${name}</text>
  ${title ? `<text x="96" y="886" fill="#ffffff" font-size="40" font-family="GwadaSerif, Georgia, serif">${title}</text>` : ""}
  ${captions}`;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style></defs>
  ${chrome}
</svg>`;
  return Buffer.from(svg);
}

function brandCardSvg(params: {
  accent: string;
  restaurantName: string;
  title: string | null;
  caption: string;
  hasPhoto: boolean;
  theme: StyleTheme;
  ctaLabel: string;
}): Buffer {
  const t = params.theme;
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const title = escapeXml((params.title?.trim() || "Diese Woche").slice(0, 40));
  const captionLines = wrapLines(params.caption, 30, 3).map(escapeXml);
  const accent = escapeXml(params.accent);
  const cta = escapeXml(params.ctaLabel.slice(0, 18));
  const css = fontFaceCss();
  const captions = captionLines
    .map(
      (line, i) =>
        `<text x="96" y="${480 + i * 40}" fill="${escapeXml(t.cardFg)}" fill-opacity="0.85" font-size="26" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
    )
    .join("");

  const photoDim = params.hasPhoto
    ? `<rect width="${SIZE}" height="${SIZE}" fill="#000000" fill-opacity="0.4"/>`
    : "";

  let body = "";
  if (t.heroVariant === "modern") {
    body = `
  ${photoDim}
  <rect x="64" y="64" width="952" height="952" fill="${escapeXml(t.cardBg)}" fill-opacity="${params.hasPhoto ? 0.88 : 1}"/>
  <rect x="64" y="64" width="8" height="952" fill="${accent}"/>
  <rect x="112" y="140" width="96" height="4" fill="${accent}"/>
  <text x="112" y="210" fill="${escapeXml(t.cardFg)}" fill-opacity="0.65" font-size="16" letter-spacing="5" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  <text x="112" y="300" fill="${escapeXml(t.cardFg)}" font-size="52" font-family="GwadaInterBold, Helvetica, sans-serif">${title}</text>
  ${captions.replaceAll('x="96"', 'x="112"')}
  <rect x="112" y="900" width="168" height="48" fill="${accent}"/>
  <text x="196" y="932" text-anchor="middle" fill="#ffffff" font-size="18" font-family="GwadaInterSemi, Helvetica, sans-serif">${cta}</text>`;
  } else if (t.heroVariant === "fancy") {
    body = `
  ${photoDim}
  <rect x="72" y="72" width="936" height="936" rx="12" fill="${escapeXml(t.cardBg)}" fill-opacity="${params.hasPhoto ? 0.82 : 1}"/>
  <rect x="72" y="72" width="936" height="936" rx="12" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="1.5"/>
  <rect x="112" y="140" width="36" height="2" fill="${accent}"/>
  <text x="112" y="210" fill="${escapeXml(t.cardFg)}" fill-opacity="0.7" font-size="15" letter-spacing="6" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  <text x="112" y="300" fill="${escapeXml(t.cardFg)}" font-size="50" font-family="GwadaSerifBold, Georgia, serif">${title}</text>
  ${captions.replaceAll('x="96"', 'x="112"')}
  <rect x="112" y="900" width="180" height="48" rx="24" fill="${accent}"/>
  <text x="202" y="932" text-anchor="middle" fill="#ffffff" font-size="18" font-family="GwadaInterSemi, Helvetica, sans-serif">${cta}</text>`;
  } else if (t.heroVariant === "warm") {
    body = `
  ${photoDim}
  <rect x="56" y="56" width="968" height="968" rx="32" fill="${escapeXml(t.cardBg)}" fill-opacity="${params.hasPhoto ? 0.86 : 1}"/>
  <rect x="96" y="140" width="72" height="6" rx="3" fill="${accent}"/>
  <text x="96" y="210" fill="${escapeXml(t.cardFg)}" fill-opacity="0.75" font-size="17" letter-spacing="3" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  <text x="96" y="300" fill="${escapeXml(t.cardFg)}" font-size="50" font-family="GwadaSerifBold, Georgia, serif">${title}</text>
  ${captions}
  <rect x="96" y="900" width="176" height="50" rx="14" fill="${accent}"/>
  <text x="184" y="933" text-anchor="middle" fill="#ffffff" font-size="18" font-family="GwadaInterSemi, Helvetica, sans-serif">${cta}</text>`;
  } else if (t.heroVariant === "fein") {
    body = `
  ${photoDim}
  <rect x="80" y="80" width="920" height="920" fill="${escapeXml(t.cardBg)}" fill-opacity="${params.hasPhoto ? 0.84 : 1}"/>
  <rect x="80" y="80" width="920" height="920" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/>
  <rect x="120" y="160" width="28" height="1" fill="${accent}"/>
  <text x="120" y="230" fill="${escapeXml(t.cardFg)}" fill-opacity="0.55" font-size="14" letter-spacing="7" font-family="GwadaInter, Helvetica, sans-serif">${name}</text>
  <text x="120" y="310" fill="${escapeXml(t.cardFg)}" font-size="44" font-family="GwadaSerif, Georgia, serif">${title}</text>
  ${captions.replaceAll('x="96"', 'x="120"')}
  <rect x="120" y="910" width="140" height="42" fill="${accent}"/>
  <text x="190" y="938" text-anchor="middle" fill="#ffffff" font-size="15" letter-spacing="2" font-family="GwadaInter, Helvetica, sans-serif">${cta}</text>`;
  } else {
    body = `
  ${params.hasPhoto ? "" : `<rect width="${SIZE}" height="${SIZE}" fill="${escapeXml(t.cardBg)}"/>`}
  ${photoDim}
  ${params.hasPhoto ? `<rect width="${SIZE}" height="${SIZE}" fill="${escapeXml(t.cardBg)}" fill-opacity="0.9"/>` : ""}
  <rect x="72" y="140" width="48" height="3" rx="1.5" fill="${accent}"/>
  <text x="72" y="210" fill="${escapeXml(t.cardFg)}" fill-opacity="0.7" font-size="18" letter-spacing="3" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  <text x="72" y="300" fill="${escapeXml(t.cardFg)}" font-size="52" font-family="GwadaInterBold, Helvetica, sans-serif">${title}</text>
  ${captions.replaceAll('x="96"', 'x="72"')}
  <rect x="72" y="910" width="160" height="46" rx="8" fill="${accent}"/>
  <text x="152" y="940" text-anchor="middle" fill="#ffffff" font-size="18" font-family="GwadaInterSemi, Helvetica, sans-serif">${cta}</text>`;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style></defs>
  ${params.hasPhoto ? "" : `<rect width="${SIZE}" height="${SIZE}" fill="${escapeXml(t.bg)}"/>`}
  ${body}
</svg>`;
  return Buffer.from(svg);
}

async function preparePhotoBase(
  photo: Buffer,
  photoLook: SocialPhotoLook,
): Promise<Buffer> {
  let pipeline = sharp(photo)
    .rotate()
    .resize(SIZE, SIZE, { fit: "cover", position: "centre" });
  if (photoLook === "warm") {
    pipeline = pipeline.modulate({ saturation: 1.12, brightness: 1.02 });
  } else if (photoLook === "cool") {
    pipeline = pipeline.modulate({ saturation: 0.92, brightness: 1.03 });
  }
  return pipeline.toBuffer();
}

async function loadRestaurantLogoMark(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<Buffer | null> {
  const { data } = await sb
    .from("restaurants")
    .select("avatar_storage_path")
    .eq("id", restaurantId)
    .maybeSingle();
  const path =
    typeof data?.avatar_storage_path === "string"
      ? data.avatar_storage_path.trim()
      : "";
  if (!path) return null;
  const url = await resolveRestaurantProfileImageSignedUrl(sb, path, 3600);
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 32) return null;
    const circleSvg = Buffer.from(
      `<svg width="${LOGO_MARK_SIZE}" height="${LOGO_MARK_SIZE}" xmlns="http://www.w3.org/2000/svg"><circle cx="${LOGO_MARK_SIZE / 2}" cy="${LOGO_MARK_SIZE / 2}" r="${LOGO_MARK_SIZE / 2}" fill="#fff"/></svg>`,
    );
    return sharp(Buffer.from(ab))
      .rotate()
      .resize(LOGO_MARK_SIZE, LOGO_MARK_SIZE, { fit: "cover", position: "centre" })
      .composite([{ input: circleSvg, blend: "dest-in" }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

function logoComposite(
  logo: Buffer | null,
  layout: SocialFeedLayoutId,
): Array<{ input: Buffer; top: number; left: number }> {
  if (!logo) return [];
  if (layout === "signature_brand") {
    return [
      {
        input: logo,
        top: 304,
        left: Math.round((SIZE - LOGO_MARK_SIZE) / 2),
      },
    ];
  }
  if (layout === "atelier_split") {
    return [{ input: logo, top: 48, left: SIZE - LOGO_MARK_SIZE - 48 }];
  }
  if (layout === "soiree_event") {
    return [
      {
        input: logo,
        top: 96,
        left: Math.round((SIZE - LOGO_MARK_SIZE) / 2),
      },
    ];
  }
  // editorial_hero — Marke oben rechts
  return [{ input: logo, top: 48, left: SIZE - LOGO_MARK_SIZE - 48 }];
}

function premiumEditorialOverlay(params: {
  accent: string;
  secondary: string | null;
  restaurantName: string;
  title: string | null;
  captionLine: string;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 48));
  const title = params.title ? escapeXml(params.title.slice(0, 42)) : "";
  const captionLines = wrapLines(params.captionLine, 38, 2).map(escapeXml);
  const accent = escapeXml(params.accent);
  const secondary = escapeXml(params.secondary ?? params.accent);
  const css = fontFaceCss();
  const captionY = title ? 930 : 900;
  const captions = captionLines
    .map(
      (line, i) =>
        `<text x="72" y="${captionY + i * 34}" fill="#ffffff" fill-opacity="0.9" font-size="26" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
    )
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="55%" stop-color="#000" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.58"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <text x="72" y="820" fill="#ffffff" fill-opacity="0.72" font-size="16" letter-spacing="4" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  <rect x="72" y="838" width="40" height="1.5" fill="${accent}"/>
  <rect x="118" y="838" width="16" height="1.5" fill="${secondary}" fill-opacity="0.7"/>
  ${title ? `<text x="72" y="890" fill="#ffffff" font-size="46" font-family="GwadaSerifBold, Georgia, serif">${title}</text>` : ""}
  ${captions}
</svg>`;
  return Buffer.from(svg);
}

function premiumAtelierOverlay(params: {
  accent: string;
  secondary: string | null;
  dark: string;
  light: string;
  restaurantName: string;
  title: string | null;
  captionLine: string;
  ctaLabel: string;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const title = escapeXml((params.title?.trim() || "Diese Woche").slice(0, 40));
  const captionLines = wrapLines(params.captionLine, 34, 2).map(escapeXml);
  const accent = escapeXml(params.accent);
  const secondary = escapeXml(params.secondary ?? params.accent);
  const dark = escapeXml(params.dark);
  const light = escapeXml(params.light);
  const cta = escapeXml(`${params.ctaLabel.slice(0, 28)} →`);
  const css = fontFaceCss();
  const captions = captionLines
    .map(
      (line, i) =>
        `<text x="72" y="${760 + i * 32}" fill="${light}" fill-opacity="0.82" font-size="24" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
    )
    .join("");
  const panelTop = Math.round(SIZE * 0.58);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style></defs>
  <rect x="0" y="${panelTop}" width="${SIZE}" height="${SIZE - panelTop}" fill="${dark}"/>
  <rect x="0" y="${panelTop}" width="${SIZE}" height="3" fill="${secondary}" fill-opacity="0.55"/>
  <text x="72" y="700" fill="${light}" fill-opacity="0.65" font-size="15" letter-spacing="4" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  <text x="72" y="748" fill="${light}" font-size="40" font-family="GwadaSerifBold, Georgia, serif">${title}</text>
  ${captions}
  <rect x="72" y="920" width="48" height="1.5" fill="${accent}"/>
  <text x="72" y="960" fill="${accent}" font-size="20" font-family="GwadaInterSemi, Helvetica, sans-serif">${cta}</text>
</svg>`;
  return Buffer.from(svg);
}

function premiumSoireeOverlay(params: {
  accent: string;
  secondary: string | null;
  light: string;
  restaurantName: string;
  title: string | null;
  captionLine: string;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const title = escapeXml((params.title?.trim() || "Event").slice(0, 36));
  const captionLines = wrapLines(params.captionLine, 32, 3).map(escapeXml);
  const accent = escapeXml(params.accent);
  const secondary = escapeXml(params.secondary ?? params.accent);
  const light = escapeXml(params.light);
  const css = fontFaceCss();
  const captions = captionLines
    .map(
      (line, i) =>
        `<text x="540" y="${620 + i * 34}" text-anchor="middle" fill="${light}" fill-opacity="0.85" font-size="24" font-family="GwadaInter, Helvetica, sans-serif">${line}</text>`,
    )
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style></defs>
  <rect width="${SIZE}" height="${SIZE}" fill="#000000" fill-opacity="0.35"/>
  <rect x="56" y="56" width="968" height="968" fill="none" stroke="${accent}" stroke-opacity="0.75" stroke-width="1.5"/>
  <rect x="72" y="72" width="936" height="936" fill="none" stroke="${secondary}" stroke-opacity="0.28" stroke-width="1"/>
  <text x="540" y="420" text-anchor="middle" fill="${light}" fill-opacity="0.7" font-size="16" letter-spacing="5" font-family="GwadaInterSemi, Helvetica, sans-serif">${name}</text>
  <text x="540" y="520" text-anchor="middle" fill="${light}" font-size="56" font-family="GwadaSerifBold, Georgia, serif">${title}</text>
  ${captions}
  <rect x="492" y="760" width="96" height="1.5" fill="${accent}"/>
</svg>`;
  return Buffer.from(svg);
}

function premiumSignatureOverlay(params: {
  accent: string;
  secondary: string | null;
  dark: string;
  light: string;
  restaurantName: string;
  title: string | null;
  captionLine: string;
  hasPhoto: boolean;
  hideMarkCircle: boolean;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const title = escapeXml((params.title?.trim() || "").slice(0, 40));
  const line = escapeXml(
    (params.captionLine || params.title || "Willkommen").slice(0, 72),
  );
  const accent = escapeXml(params.accent);
  const secondary = escapeXml(params.secondary ?? params.accent);
  const dark = escapeXml(params.dark);
  const light = escapeXml(params.light);
  const css = fontFaceCss();
  const wash = params.hasPhoto
    ? `<rect width="${SIZE}" height="${SIZE}" fill="${light}" fill-opacity="0.92"/>`
    : `<rect width="${SIZE}" height="${SIZE}" fill="${light}"/>`;
  const mark = params.hideMarkCircle
    ? ""
    : `<circle cx="540" cy="340" r="36" fill="${secondary}" fill-opacity="0.22" stroke="${accent}" stroke-opacity="0.55" stroke-width="1"/>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style></defs>
  ${wash}
  ${mark}
  <text x="540" y="470" text-anchor="middle" fill="${dark}" font-size="48" font-family="GwadaSerifBold, Georgia, serif">${name}</text>
  <rect x="492" y="510" width="96" height="1.5" fill="${accent}"/>
  <text x="540" y="590" text-anchor="middle" fill="${dark}" fill-opacity="0.88" font-size="30" font-style="italic" font-family="GwadaSerif, Georgia, serif">${line}</text>
  ${title ? `<text x="540" y="680" text-anchor="middle" fill="${dark}" fill-opacity="0.45" font-size="16" letter-spacing="4" font-family="GwadaInter, Helvetica, sans-serif">${title}</text>` : ""}
</svg>`;
  return Buffer.from(svg);
}

async function renderPremiumFeedLayout(params: {
  sb: SupabaseClient;
  restaurantId: string;
  feedLayout: SocialFeedLayoutId;
  feedPalette: SocialFeedPalette;
  photoLook: SocialPhotoLook;
  restaurantName: string;
  title: string | null;
  caption: string;
  asset: SocialSuggestionAsset;
  ctaLabel: string;
  overlayLine?: string | null;
}): Promise<Buffer> {
  const accent =
    normalizeHex(params.feedPalette.accent) ??
    DEFAULT_SOCIAL_FEED_PALETTE.accent;
  const dark =
    normalizeHex(params.feedPalette.surfaceDark) ??
    DEFAULT_SOCIAL_FEED_PALETTE.surfaceDark;
  const light =
    normalizeHex(params.feedPalette.surfaceLight) ??
    DEFAULT_SOCIAL_FEED_PALETTE.surfaceLight;
  const secondary = params.feedPalette.secondary
    ? (normalizeHex(params.feedPalette.secondary) ?? null)
    : null;
  const captionLine =
    (params.overlayLine?.trim() ||
      overlayLineFromCaption(params.caption, { cta: params.ctaLabel })) ||
    "";
  const [photo, logoMark] = await Promise.all([
    loadSocialImageBuffer(params.sb, params.restaurantId, params.asset),
    loadRestaurantLogoMark(params.sb, params.restaurantId),
  ]);

  if (params.feedLayout === "signature_brand" || !photo) {
    const base = photo
      ? await preparePhotoBase(photo, params.photoLook)
      : await sharp({
          create: {
            width: SIZE,
            height: SIZE,
            channels: 3,
            background: light,
          },
        })
          .png()
          .toBuffer();
    const overlay = premiumSignatureOverlay({
      accent,
      secondary,
      dark,
      light,
      restaurantName: params.restaurantName,
      title: params.title,
      captionLine: captionLine || params.caption,
      hasPhoto: Boolean(photo),
      hideMarkCircle: Boolean(logoMark),
    });
    return sharp(base)
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...logoComposite(logoMark, "signature_brand"),
      ])
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  }

  const base = await preparePhotoBase(photo, params.photoLook);

  if (params.feedLayout === "atelier_split") {
    const overlay = premiumAtelierOverlay({
      accent,
      secondary,
      dark,
      light,
      restaurantName: params.restaurantName,
      title: params.title,
      captionLine,
      ctaLabel: params.ctaLabel,
    });
    return sharp(base)
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...logoComposite(logoMark, "atelier_split"),
      ])
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  }

  if (params.feedLayout === "soiree_event") {
    const overlay = premiumSoireeOverlay({
      accent,
      secondary,
      light,
      restaurantName: params.restaurantName,
      title: params.title,
      captionLine,
    });
    return sharp(base)
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...logoComposite(logoMark, "soiree_event"),
      ])
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  }

  const overlay = premiumEditorialOverlay({
    accent,
    secondary,
    restaurantName: params.restaurantName,
    title: params.title,
    captionLine,
  });
  return sharp(base)
    .composite([
      { input: overlay, top: 0, left: 0 },
      ...logoComposite(logoMark, "editorial_hero"),
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

export async function renderSocialTemplateImage(params: {
  sb: SupabaseClient;
  restaurantId: string;
  templateId: SocialTemplateId;
  stylePreset: SocialStylePreset;
  accentHex: string;
  restaurantName: string;
  title: string | null;
  caption: string;
  asset: SocialSuggestionAsset;
  ctaLabel?: string;
  /** Premium Feed Brand System — wenn gesetzt, statt Legacy-Chrome. */
  feedLayout?: SocialFeedLayoutId;
  feedPalette?: SocialFeedPalette;
  photoLook?: SocialPhotoLook;
  overlayLine?: string | null;
}): Promise<Buffer> {
  const ctaLabel = params.ctaLabel?.trim() || "Reservieren";

  if (params.feedLayout) {
    return renderPremiumFeedLayout({
      sb: params.sb,
      restaurantId: params.restaurantId,
      feedLayout: params.feedLayout,
      feedPalette: params.feedPalette ?? DEFAULT_SOCIAL_FEED_PALETTE,
      photoLook: params.photoLook ?? "warm",
      restaurantName: params.restaurantName,
      title: params.title,
      caption: params.caption,
      asset: params.asset,
      ctaLabel,
      overlayLine: params.overlayLine,
    });
  }

  const accent = normalizeHex(params.accentHex) ?? DEFAULT_ACCENT_HEX;
  const theme = STYLE_THEMES[params.stylePreset] ?? STYLE_THEMES.schlicht;
  const captionLine =
    params.caption
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)[0] ?? "";
  const photo = await loadSocialImageBuffer(
    params.sb,
    params.restaurantId,
    params.asset,
  );

  if (params.templateId === "brand_card" || !photo) {
    const base = photo
      ? await sharp(photo)
          .rotate()
          .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
          .toBuffer()
      : await sharp({
          create: {
            width: SIZE,
            height: SIZE,
            channels: 3,
            background: theme.bg,
          },
        })
          .png()
          .toBuffer();

    const overlay = brandCardSvg({
      accent,
      restaurantName: params.restaurantName,
      title: params.title,
      caption: captionLine || params.caption,
      hasPhoto: Boolean(photo),
      theme,
      ctaLabel,
    });

    return sharp(base)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  }

  const base = await sharp(photo)
    .rotate()
    .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
    .toBuffer();

  const overlay = foodHeroOverlaySvg({
    accent,
    restaurantName: params.restaurantName,
    title: params.title,
    captionLine,
    variant: theme.heroVariant,
  });

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/** Rendert Template und lädt es öffentlich erreichbar in news-media (signed URL). */
export async function renderAndUploadSocialTemplate(params: {
  sb: SupabaseClient;
  restaurantId: string;
  suggestionId: string;
  templateId: SocialTemplateId;
  stylePreset: SocialStylePreset;
  accentHex: string;
  restaurantName: string;
  title: string | null;
  caption: string;
  asset: SocialSuggestionAsset;
  ctaLabel?: string;
  feedLayout?: SocialFeedLayoutId;
  feedPalette?: SocialFeedPalette;
  photoLook?: SocialPhotoLook;
  overlayLine?: string | null;
}): Promise<
  | { ok: true; imageUrl: string; storagePath: string }
  | { ok: false; error: string }
> {
  try {
    const jpeg = await renderSocialTemplateImage(params);
    const storagePath = `${params.restaurantId}/social-autopilot/${params.suggestionId}/${randomUUID()}.jpg`;
    const upload = await params.sb.storage
      .from(NEWS_MEDIA_BUCKET)
      .upload(storagePath, jpeg, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (upload.error) {
      return { ok: false, error: upload.error.message };
    }
    const { data } = await params.sb.storage
      .from(NEWS_MEDIA_BUCKET)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (!data?.signedUrl) {
      return { ok: false, error: "signed_url_failed" };
    }
    return { ok: true, imageUrl: data.signedUrl, storagePath };
  } catch (e) {
    const message = e instanceof Error ? e.message : "render_failed";
    console.warn("[gwada] renderAndUploadSocialTemplate", message);
    return { ok: false, error: message };
  }
}
