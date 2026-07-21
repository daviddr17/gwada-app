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

const PRESET_BG: Record<SocialStylePreset, string> = {
  modern_plain: "#f4f4f5",
  warm_gastro: "#2a211c",
  dark_fine: "#0a0a0a",
};

const PRESET_FG: Record<SocialStylePreset, string> = {
  modern_plain: "#171717",
  warm_gastro: "#f7f0e8",
  dark_fine: "#fafafa",
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
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const title = params.title
    ? escapeXml(params.title.slice(0, 48))
    : "";
  const captionLines = wrapLines(params.captionLine, 42, 2).map(escapeXml);
  const titleBlock = title
    ? `<text x="72" y="880" fill="#ffffff" font-size="48" font-weight="700" font-family="Georgia, 'Times New Roman', serif">${title}</text>`
    : "";
  const captionY0 = title ? 940 : 900;
  const captionTexts = captionLines
    .map(
      (line, i) =>
        `<text x="72" y="${captionY0 + i * 36}" fill="#ffffff" fill-opacity="0.92" font-size="28" font-family="Helvetica, Arial, sans-serif">${line}</text>`,
    )
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="45%" stop-color="#000000" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <rect x="72" y="780" width="88" height="8" rx="4" fill="${escapeXml(params.accent)}"/>
  <text x="72" y="830" fill="#ffffff" fill-opacity="0.85" font-size="22" letter-spacing="4" font-family="Helvetica, Arial, sans-serif">${name}</text>
  ${titleBlock}
  ${captionTexts}
</svg>`;
  return Buffer.from(svg);
}

function brandCardSvg(params: {
  accent: string;
  bg: string;
  fg: string;
  restaurantName: string;
  title: string | null;
  caption: string;
  hasPhoto: boolean;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const title = escapeXml((params.title?.trim() || "Diese Woche").slice(0, 48));
  const captionLines = wrapLines(params.caption, 34, 4).map(escapeXml);
  const captionTexts = captionLines
    .map(
      (line, i) =>
        `<text x="88" y="${520 + i * 44}" fill="${escapeXml(params.fg)}" fill-opacity="0.9" font-size="30" font-family="Helvetica, Arial, sans-serif">${line}</text>`,
    )
    .join("");
  const photoDim = params.hasPhoto
    ? `<rect width="${SIZE}" height="${SIZE}" fill="#000000" fill-opacity="0.45"/>`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" fill="${escapeXml(params.bg)}"/>
  ${photoDim}
  <rect x="88" y="120" width="96" height="10" rx="5" fill="${escapeXml(params.accent)}"/>
  <text x="88" y="210" fill="${escapeXml(params.fg)}" fill-opacity="0.75" font-size="24" letter-spacing="5" font-family="Helvetica, Arial, sans-serif">${name}</text>
  <text x="88" y="320" fill="${escapeXml(params.fg)}" font-size="64" font-weight="700" font-family="Georgia, 'Times New Roman', serif">${title}</text>
  ${captionTexts}
  <rect x="88" y="920" width="160" height="48" rx="10" fill="${escapeXml(params.accent)}"/>
  <text x="168" y="952" text-anchor="middle" fill="#ffffff" font-size="22" font-weight="600" font-family="Helvetica, Arial, sans-serif">Reservieren</text>
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
}): Promise<Buffer> {
  const accent = normalizeHex(params.accentHex) ?? DEFAULT_ACCENT_HEX;
  const bg = PRESET_BG[params.stylePreset] ?? PRESET_BG.warm_gastro;
  const fg = PRESET_FG[params.stylePreset] ?? PRESET_FG.warm_gastro;
  const captionLine = params.caption.split("\n").map((l) => l.trim()).filter(Boolean)[0] ?? "";
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
            background: bg,
          },
        })
          .png()
          .toBuffer();

    const overlay = brandCardSvg({
      accent,
      bg,
      fg,
      restaurantName: params.restaurantName,
      title: params.title,
      caption: captionLine || params.caption,
      hasPhoto: Boolean(photo),
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
