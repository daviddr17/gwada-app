import "server-only";

import { randomUUID } from "crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NEWS_MEDIA_BUCKET } from "@/lib/news/news-media";
import type {
  SocialStylePreset,
  SocialTemplateId,
} from "@/lib/social/social-brand-kit";
import { loadSocialImageBuffer } from "@/lib/social/social-asset-resolve-server";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

const SIZE = 1080;

type StyleTheme = {
  bg: string;
  fg: string;
  mutedOpacity: number;
  nameSize: number;
  titleSize: number;
  captionSize: number;
  accentBarW: number;
  accentBarH: number;
  accentBarRx: number;
  ctaRx: number;
  ctaW: number;
  ctaH: number;
  pad: number;
  /** food_hero: Rahmen innen */
  frameInset: number;
  frameStroke: number;
  gradientBottomOpacity: number;
  nameLetterSpacing: number;
  fontTitle: string;
  fontBody: string;
  /** brand_card: weiche Karte über Foto */
  cardInset: number;
  cardRx: number;
  cardFill: string;
  cardFillOpacity: number;
};

const STYLE_THEMES: Record<SocialStylePreset, StyleTheme> = {
  schlicht: {
    bg: "#f4f4f5",
    fg: "#171717",
    mutedOpacity: 0.72,
    nameSize: 22,
    titleSize: 56,
    captionSize: 28,
    accentBarW: 72,
    accentBarH: 6,
    accentBarRx: 3,
    ctaRx: 8,
    ctaW: 168,
    ctaH: 48,
    pad: 72,
    frameInset: 0,
    frameStroke: 0,
    gradientBottomOpacity: 0.72,
    nameLetterSpacing: 3,
    fontTitle: "Helvetica, Arial, sans-serif",
    fontBody: "Helvetica, Arial, sans-serif",
    cardInset: 0,
    cardRx: 0,
    cardFill: "#f4f4f5",
    cardFillOpacity: 1,
  },
  modern: {
    bg: "#eef2f6",
    fg: "#0f172a",
    mutedOpacity: 0.7,
    nameSize: 20,
    titleSize: 58,
    captionSize: 28,
    accentBarW: 140,
    accentBarH: 10,
    accentBarRx: 0,
    ctaRx: 0,
    ctaW: 180,
    ctaH: 50,
    pad: 80,
    frameInset: 28,
    frameStroke: 4,
    gradientBottomOpacity: 0.8,
    nameLetterSpacing: 6,
    fontTitle: "Helvetica, Arial, sans-serif",
    fontBody: "Helvetica, Arial, sans-serif",
    cardInset: 48,
    cardRx: 0,
    cardFill: "#ffffff",
    cardFillOpacity: 0.92,
  },
  warm: {
    bg: "#2a211c",
    fg: "#f7f0e8",
    mutedOpacity: 0.78,
    nameSize: 22,
    titleSize: 60,
    captionSize: 30,
    accentBarW: 96,
    accentBarH: 10,
    accentBarRx: 5,
    ctaRx: 14,
    ctaW: 176,
    ctaH: 50,
    pad: 88,
    frameInset: 36,
    frameStroke: 0,
    gradientBottomOpacity: 0.78,
    nameLetterSpacing: 4,
    fontTitle: "Georgia, 'Times New Roman', serif",
    fontBody: "Helvetica, Arial, sans-serif",
    cardInset: 56,
    cardRx: 28,
    cardFill: "#2a211c",
    cardFillOpacity: 0.88,
  },
  fancy: {
    bg: "#1a1220",
    fg: "#faf5ff",
    mutedOpacity: 0.82,
    nameSize: 24,
    titleSize: 64,
    captionSize: 30,
    accentBarW: 120,
    accentBarH: 8,
    accentBarRx: 4,
    ctaRx: 24,
    ctaW: 200,
    ctaH: 52,
    pad: 96,
    frameInset: 40,
    frameStroke: 10,
    gradientBottomOpacity: 0.85,
    nameLetterSpacing: 8,
    fontTitle: "Georgia, 'Times New Roman', serif",
    fontBody: "Helvetica, Arial, sans-serif",
    cardInset: 64,
    cardRx: 36,
    cardFill: "#120c18",
    cardFillOpacity: 0.78,
  },
  fein: {
    bg: "#0a0a0a",
    fg: "#fafafa",
    mutedOpacity: 0.65,
    nameSize: 18,
    titleSize: 52,
    captionSize: 26,
    accentBarW: 48,
    accentBarH: 2,
    accentBarRx: 0,
    ctaRx: 2,
    ctaW: 150,
    ctaH: 44,
    pad: 100,
    frameInset: 48,
    frameStroke: 1,
    gradientBottomOpacity: 0.68,
    nameLetterSpacing: 10,
    fontTitle: "Georgia, 'Times New Roman', serif",
    fontBody: "Helvetica, Arial, sans-serif",
    cardInset: 72,
    cardRx: 4,
    cardFill: "#0a0a0a",
    cardFillOpacity: 0.82,
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
  style: StyleTheme;
}): Buffer {
  const t = params.style;
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const title = params.title
    ? escapeXml(params.title.slice(0, 48))
    : "";
  const captionLines = wrapLines(params.captionLine, 40, 2).map(escapeXml);
  const pad = t.pad;
  const titleBlock = title
    ? `<text x="${pad}" y="880" fill="#ffffff" font-size="${t.titleSize * 0.75}" font-weight="700" font-family="${t.fontTitle}">${title}</text>`
    : "";
  const captionY0 = title ? 940 : 900;
  const captionTexts = captionLines
    .map(
      (line, i) =>
        `<text x="${pad}" y="${captionY0 + i * 36}" fill="#ffffff" fill-opacity="0.92" font-size="${t.captionSize}" font-family="${t.fontBody}">${line}</text>`,
    )
    .join("");

  const frame =
    t.frameInset > 0 && t.frameStroke > 0
      ? `<rect x="${t.frameInset}" y="${t.frameInset}" width="${SIZE - t.frameInset * 2}" height="${SIZE - t.frameInset * 2}" fill="none" stroke="${escapeXml(params.accent)}" stroke-width="${t.frameStroke}" opacity="0.85"/>`
      : t.frameInset > 0
        ? `<rect x="${t.frameInset}" y="${t.frameInset}" width="${SIZE - t.frameInset * 2}" height="${SIZE - t.frameInset * 2}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.25"/>`
        : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="40%" stop-color="#000000" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="${t.gradientBottomOpacity}"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  ${frame}
  <rect x="${pad}" y="780" width="${t.accentBarW}" height="${t.accentBarH}" rx="${t.accentBarRx}" fill="${escapeXml(params.accent)}"/>
  <text x="${pad}" y="830" fill="#ffffff" fill-opacity="0.88" font-size="${t.nameSize}" letter-spacing="${t.nameLetterSpacing}" font-family="${t.fontBody}">${name}</text>
  ${titleBlock}
  ${captionTexts}
</svg>`;
  return Buffer.from(svg);
}

function brandCardSvg(params: {
  accent: string;
  restaurantName: string;
  title: string | null;
  caption: string;
  hasPhoto: boolean;
  style: StyleTheme;
  ctaLabel: string;
}): Buffer {
  const t = params.style;
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const title = escapeXml((params.title?.trim() || "Diese Woche").slice(0, 48));
  const captionLines = wrapLines(params.caption, 32, 4).map(escapeXml);
  const pad = t.pad;
  const captionTexts = captionLines
    .map(
      (line, i) =>
        `<text x="${pad}" y="${520 + i * 44}" fill="${escapeXml(t.fg)}" fill-opacity="0.9" font-size="${t.captionSize}" font-family="${t.fontBody}">${line}</text>`,
    )
    .join("");

  const photoDim = params.hasPhoto
    ? `<rect width="${SIZE}" height="${SIZE}" fill="#000000" fill-opacity="0.35"/>`
    : "";

  const card =
    t.cardInset > 0
      ? `<rect x="${t.cardInset}" y="${t.cardInset}" width="${SIZE - t.cardInset * 2}" height="${SIZE - t.cardInset * 2}" rx="${t.cardRx}" fill="${escapeXml(t.cardFill)}" fill-opacity="${t.cardFillOpacity}"/>`
      : `<rect width="${SIZE}" height="${SIZE}" fill="${escapeXml(t.bg)}"/>`;

  const frame =
    t.frameStroke > 0 && t.cardInset > 0
      ? `<rect x="${t.cardInset}" y="${t.cardInset}" width="${SIZE - t.cardInset * 2}" height="${SIZE - t.cardInset * 2}" rx="${t.cardRx}" fill="none" stroke="${escapeXml(params.accent)}" stroke-width="${t.frameStroke}" opacity="0.9"/>`
      : "";

  const ctaLabel = escapeXml(params.ctaLabel.slice(0, 18));
  const ctaX = pad;
  const ctaY = 920;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  ${params.hasPhoto ? "" : `<rect width="${SIZE}" height="${SIZE}" fill="${escapeXml(t.bg)}"/>`}
  ${photoDim}
  ${card}
  ${frame}
  <rect x="${pad}" y="140" width="${t.accentBarW}" height="${t.accentBarH}" rx="${t.accentBarRx}" fill="${escapeXml(params.accent)}"/>
  <text x="${pad}" y="220" fill="${escapeXml(t.fg)}" fill-opacity="${t.mutedOpacity}" font-size="${t.nameSize}" letter-spacing="${t.nameLetterSpacing}" font-family="${t.fontBody}">${name}</text>
  <text x="${pad}" y="320" fill="${escapeXml(t.fg)}" font-size="${t.titleSize}" font-weight="700" font-family="${t.fontTitle}">${title}</text>
  ${captionTexts}
  <rect x="${ctaX}" y="${ctaY}" width="${t.ctaW}" height="${t.ctaH}" rx="${t.ctaRx}" fill="${escapeXml(params.accent)}"/>
  <text x="${ctaX + t.ctaW / 2}" y="${ctaY + t.ctaH / 2 + 8}" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="600" font-family="${t.fontBody}">${ctaLabel}</text>
</svg>`;
  return Buffer.from(svg);
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
}): Promise<Buffer> {
  const accent = normalizeHex(params.accentHex) ?? DEFAULT_ACCENT_HEX;
  const style = STYLE_THEMES[params.stylePreset] ?? STYLE_THEMES.schlicht;
  const captionLine = params.caption.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "";
  const photo = await loadSocialImageBuffer(
    params.sb,
    params.restaurantId,
    params.asset,
  );
  const ctaLabel = params.ctaLabel?.trim() || "Reservieren";

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
            background: style.bg,
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
      style,
      ctaLabel,
    });

    return sharp(base)
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg({ quality: 88, mozjpeg: true })
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
    style,
  });

  return sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 88, mozjpeg: true })
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
