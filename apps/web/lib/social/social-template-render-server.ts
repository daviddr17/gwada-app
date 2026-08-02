import "server-only";

import { randomUUID } from "crypto";
import { existsSync } from "fs";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NEWS_MEDIA_BUCKET } from "@/lib/news/news-media";
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

/** Rendert Premium-Feed-Layout und lädt es in news-media (signed URL). */
export async function renderAndUploadSocialTemplate(params: {
  sb: SupabaseClient;
  restaurantId: string;
  suggestionId: string;
  restaurantName: string;
  title: string | null;
  caption: string;
  asset: SocialSuggestionAsset;
  ctaLabel?: string;
  feedLayout: SocialFeedLayoutId;
  feedPalette?: SocialFeedPalette;
  photoLook?: SocialPhotoLook;
  overlayLine?: string | null;
}): Promise<
  | { ok: true; imageUrl: string; storagePath: string }
  | { ok: false; error: string }
> {
  try {
    const jpeg = await renderPremiumFeedLayout({
      sb: params.sb,
      restaurantId: params.restaurantId,
      feedLayout: params.feedLayout,
      feedPalette: params.feedPalette ?? DEFAULT_SOCIAL_FEED_PALETTE,
      photoLook: params.photoLook ?? "warm",
      restaurantName: params.restaurantName,
      title: params.title,
      caption: params.caption,
      asset: params.asset,
      ctaLabel: params.ctaLabel?.trim() || "Reservieren",
      overlayLine: params.overlayLine,
    });
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
