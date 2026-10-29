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
import type { SocialStylePreset } from "@/lib/social/social-brand-kit";
import {
  brandAtelierBarMotifAt,
  brandMotifSvg,
  brandSoireeFrameSvg,
  brandSoireeRuleMotifAt,
  isSocialDisplayFontSerif,
  type SocialDisplayFontId,
} from "@/lib/social/social-brand-visual-system";
import { overlayLineFromCaption } from "@/lib/social/social-caption-templates";
import { loadSocialImageBuffer } from "@/lib/social/social-asset-resolve-server";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import { adaptSocialImageToFormat } from "@/lib/social/social-media-format-adapt";
import {
  SOCIAL_MEDIA_FORMATS,
  type SocialMediaFormatId,
} from "@/lib/social/social-media-formats";
import {
  layoutHeadline,
  layoutSupportingLine,
  wrapLayoutLines,
} from "@/lib/social/social-template-layout-text";
import { normalizeHex } from "@/lib/theme/color-utils";

const SIZE = 1080;
const LOGO_MARK_SIZE = 96;
const LOGO_RING = 4;

const FONT_INTER_SEMI =
  "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf";
const FONT_INTER_BOLD =
  "/usr/share/fonts/truetype/macos/Inter-Bold.ttf";
const FONT_INTER_REG =
  "/usr/share/fonts/truetype/macos/Inter-Regular.ttf";
const FONT_INTER_MED =
  "/usr/share/fonts/truetype/macos/Inter-Medium.ttf";
const FONT_INTER_ITALIC =
  "/usr/share/fonts/truetype/macos/Inter-Italic.ttf";
const FONT_PUBLIC_BOLD =
  "/usr/share/fonts/truetype/macos/PublicSans-Bold.ttf";
const FONT_PUBLIC_REG =
  "/usr/share/fonts/truetype/macos/PublicSans-Regular.ttf";
const FONT_PUBLIC_ITALIC =
  "/usr/share/fonts/truetype/macos/PublicSans-Italic.ttf";
const FONT_NOTO_BOLD =
  "/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf";
const FONT_NOTO_REG =
  "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf";
const FONT_NOTO_ITALIC =
  "/usr/share/fonts/truetype/noto/NotoSerif-Italic.ttf";
const FONT_TINOS_BOLD =
  "/usr/share/fonts/truetype/croscore/Tinos-Bold.ttf";
const FONT_TINOS_REG =
  "/usr/share/fonts/truetype/croscore/Tinos-Regular.ttf";
const FONT_TINOS_ITALIC =
  "/usr/share/fonts/truetype/croscore/Tinos-Italic.ttf";
const FONT_ARIMO_BOLD =
  "/usr/share/fonts/truetype/croscore/Arimo-Bold.ttf";
const FONT_ARIMO_REG =
  "/usr/share/fonts/truetype/croscore/Arimo-Regular.ttf";
const FONT_ARIMO_ITALIC =
  "/usr/share/fonts/truetype/croscore/Arimo-Italic.ttf";

type BrandTypeKit = {
  css: string;
  /** Headline / restaurant name display face */
  display: string;
  displayItalic: string;
  /** Tracked UI / CTA — Inter when display is serif */
  ui: string;
  support: string;
};

function faceCss(family: string, path: string): string {
  if (!existsSync(path)) return "";
  return `@font-face{font-family:'${family}';src:url('file://${path}');}`;
}

function brandTypeKit(displayFont: SocialDisplayFontId): BrandTypeKit {
  const uiFaces =
    faceCss("GwadaUi", FONT_INTER_REG) +
    faceCss("GwadaUiMed", FONT_INTER_MED) +
    faceCss("GwadaUiSemi", FONT_INTER_SEMI) +
    faceCss("GwadaUiBold", FONT_INTER_BOLD);

  let displayFaces = "";
  let display = "GwadaDisplayBold, Georgia, serif";
  let displayItalic = "GwadaDisplayItalic, Georgia, serif";
  let ui = "GwadaUiSemi, Helvetica, sans-serif";
  let support = "GwadaUiMed, Helvetica, sans-serif";

  if (displayFont === "inter") {
    displayFaces =
      faceCss("GwadaDisplay", FONT_INTER_REG) +
      faceCss("GwadaDisplayBold", FONT_INTER_BOLD) +
      faceCss("GwadaDisplayItalic", FONT_INTER_ITALIC) +
      faceCss("GwadaDisplaySemi", FONT_INTER_SEMI);
    display = "GwadaDisplayBold, Helvetica, sans-serif";
    displayItalic = "GwadaDisplayItalic, Helvetica, sans-serif";
    ui = "GwadaDisplaySemi, Helvetica, sans-serif";
    support = "GwadaUiMed, Helvetica, sans-serif";
  } else if (displayFont === "public_sans") {
    displayFaces =
      faceCss("GwadaDisplay", FONT_PUBLIC_REG) +
      faceCss("GwadaDisplayBold", FONT_PUBLIC_BOLD) +
      faceCss("GwadaDisplayItalic", FONT_PUBLIC_ITALIC);
    display = "GwadaDisplayBold, Helvetica, sans-serif";
    displayItalic = "GwadaDisplayItalic, Helvetica, sans-serif";
    ui = "GwadaDisplayBold, Helvetica, sans-serif";
    support = "GwadaDisplay, Helvetica, sans-serif";
  } else if (displayFont === "tinos") {
    displayFaces =
      faceCss("GwadaDisplay", FONT_TINOS_REG) +
      faceCss("GwadaDisplayBold", FONT_TINOS_BOLD) +
      faceCss("GwadaDisplayItalic", FONT_TINOS_ITALIC);
    display = "GwadaDisplayBold, Georgia, serif";
    displayItalic = "GwadaDisplayItalic, Georgia, serif";
  } else if (displayFont === "arimo") {
    displayFaces =
      faceCss("GwadaDisplay", FONT_ARIMO_REG) +
      faceCss("GwadaDisplayBold", FONT_ARIMO_BOLD) +
      faceCss("GwadaDisplayItalic", FONT_ARIMO_ITALIC);
    display = "GwadaDisplayBold, Helvetica, sans-serif";
    displayItalic = "GwadaDisplayItalic, Helvetica, sans-serif";
    ui = "GwadaDisplayBold, Helvetica, sans-serif";
    support = "GwadaDisplay, Helvetica, sans-serif";
  } else {
    // noto_serif (default agency look)
    displayFaces =
      faceCss("GwadaDisplay", FONT_NOTO_REG) +
      faceCss("GwadaDisplayBold", FONT_NOTO_BOLD) +
      faceCss("GwadaDisplayItalic", FONT_NOTO_ITALIC);
    display = "GwadaDisplayBold, Georgia, serif";
    displayItalic = "GwadaDisplayItalic, Georgia, serif";
  }

  if (isSocialDisplayFontSerif(displayFont)) {
    ui = "GwadaUiSemi, Helvetica, sans-serif";
    support = "GwadaUiMed, Helvetica, sans-serif";
  }

  return {
    css: uiFaces + displayFaces,
    display,
    displayItalic,
    ui,
    support,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Agency photo grade: sharpen + look + soft vignette. */
async function preparePhotoBase(
  photo: Buffer,
  photoLook: SocialPhotoLook,
): Promise<Buffer> {
  let pipeline = sharp(photo)
    .rotate()
    .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .sharpen({ sigma: 0.7 });
  if (photoLook === "warm") {
    pipeline = pipeline.modulate({
      saturation: 1.14,
      brightness: 1.03,
      hue: 4,
    });
  } else if (photoLook === "cool") {
    pipeline = pipeline.modulate({
      saturation: 0.9,
      brightness: 1.04,
      hue: -6,
    });
  } else {
    pipeline = pipeline.modulate({ saturation: 1.02, brightness: 1.01 });
  }
  const graded = await pipeline.toBuffer();
  const vignette = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="v" cx="50%" cy="42%" r="72%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.28"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#v)"/>
</svg>`);
  return sharp(graded)
    .composite([{ input: vignette, top: 0, left: 0 }])
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
}

/** Logo as circular badge with white ring (agency mark). */
async function makeLogoBadge(raw: Buffer): Promise<Buffer> {
  const inner = LOGO_MARK_SIZE - LOGO_RING * 2;
  const circleInner = Buffer.from(
    `<svg width="${inner}" height="${inner}" xmlns="http://www.w3.org/2000/svg"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="#fff"/></svg>`,
  );
  const clipped = await sharp(raw)
    .rotate()
    .resize(inner, inner, { fit: "cover", position: "centre" })
    .composite([{ input: circleInner, blend: "dest-in" }])
    .png()
    .toBuffer();

  const badgeSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${LOGO_MARK_SIZE}" height="${LOGO_MARK_SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <circle cx="${LOGO_MARK_SIZE / 2}" cy="${LOGO_MARK_SIZE / 2}" r="${LOGO_MARK_SIZE / 2 - 1}" fill="#ffffff" filter="url(#s)"/>
</svg>`);
  return sharp(badgeSvg)
    .composite([
      {
        input: clipped,
        top: LOGO_RING,
        left: LOGO_RING,
      },
    ])
    .png()
    .toBuffer();
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
    return makeLogoBadge(Buffer.from(ab));
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
        top: 268,
        left: Math.round((SIZE - LOGO_MARK_SIZE) / 2),
      },
    ];
  }
  if (layout === "atelier_split") {
    return [{ input: logo, top: 44, left: SIZE - LOGO_MARK_SIZE - 44 }];
  }
  if (layout === "soiree_event") {
    return [
      {
        input: logo,
        top: 120,
        left: Math.round((SIZE - LOGO_MARK_SIZE) / 2),
      },
    ];
  }
  return [{ input: logo, top: 44, left: SIZE - LOGO_MARK_SIZE - 44 }];
}

function displayHeadlineSvg(params: {
  lines: string[];
  x: number;
  startY: number;
  fill: string;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  anchor?: "start" | "middle";
}): string {
  const anchor = params.anchor ?? "start";
  return params.lines
    .map((line, i) => {
      const y = params.startY + i * params.lineHeight;
      return `<text x="${params.x}" y="${y}" ${anchor === "middle" ? 'text-anchor="middle"' : ""} fill="${params.fill}" font-size="${params.fontSize}" font-family="${params.fontFamily}">${escapeXml(line)}</text>`;
    })
    .join("");
}

function premiumEditorialOverlay(params: {
  accent: string;
  secondary: string | null;
  restaurantName: string;
  title: string | null;
  captionLine: string;
  ctaLabel: string;
  stylePreset: SocialStylePreset;
  typeKit: BrandTypeKit;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 48).toUpperCase());
  const headline = layoutHeadline(
    params.title,
    params.captionLine,
    params.restaurantName,
  );
  const headLines = wrapLayoutLines(headline, 22, 2);
  const support = layoutSupportingLine(params.captionLine, headline);
  const supportLines = wrapLayoutLines(support, 38, 2).map(escapeXml);
  const accent = escapeXml(params.accent);
  const secondary = escapeXml(params.secondary ?? params.accent);
  const cta = escapeXml((params.ctaLabel.trim() || "Reservieren").slice(0, 28));
  const { css, display, ui, support: supportFace } = params.typeKit;
  const headBlockH = headLines.length * 58;
  const supportStart = 792 + headBlockH + 8;
  const supports = supportLines
    .map(
      (line, i) =>
        `<text x="64" y="${supportStart + i * 30}" fill="#ffffff" fill-opacity="0.86" font-size="23" font-family="${supportFace}">${line}</text>`,
    )
    .join("");
  const ctaY = Math.min(1024, supportStart + supportLines.length * 30 + 36);
  const motif = brandMotifSvg({
    stylePreset: params.stylePreset,
    accent,
    secondary,
    placement: "editorial_rule",
  });
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="38%" stop-color="#000" stop-opacity="0.05"/>
      <stop offset="72%" stop-color="#000" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.82"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  <text x="64" y="742" fill="#ffffff" fill-opacity="0.72" font-size="13" letter-spacing="6" font-family="${ui}">${name}</text>
  ${motif}
  ${displayHeadlineSvg({ lines: headLines, x: 64, startY: 820, fill: "#ffffff", fontSize: 54, lineHeight: 58, fontFamily: display })}
  ${supports}
  <text x="64" y="${ctaY}" fill="${accent}" font-size="20" letter-spacing="1" font-family="${ui}">${cta} →</text>
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
  photoBandBottom: number;
  stylePreset: SocialStylePreset;
  typeKit: BrandTypeKit;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 42).toUpperCase());
  const headline = layoutHeadline(
    params.title,
    params.captionLine,
    params.restaurantName,
  );
  const headLines = wrapLayoutLines(headline, 24, 2);
  const support = layoutSupportingLine(params.captionLine, headline);
  const supportLines = wrapLayoutLines(support, 36, 2).map(escapeXml);
  const accent = escapeXml(params.accent);
  const secondary = escapeXml(params.secondary ?? params.accent);
  const dark = escapeXml(params.dark);
  const light = escapeXml(params.light);
  const cta = escapeXml(
    `${(params.ctaLabel.trim() || "Reservieren").slice(0, 28)} →`,
  );
  const { css, display, ui, support: supportFace } = params.typeKit;
  const panelTop = params.photoBandBottom;
  const nameY = panelTop + 56;
  const headStart = nameY + 52;
  const supportStart = headStart + headLines.length * 50 + 10;
  const supports = supportLines
    .map(
      (line, i) =>
        `<text x="64" y="${supportStart + i * 30}" fill="${light}" fill-opacity="0.78" font-size="22" font-family="${supportFace}">${line}</text>`,
    )
    .join("");
  const ctaY = Math.min(SIZE - 48, supportStart + supportLines.length * 30 + 44);
  const motif = brandAtelierBarMotifAt(
    params.stylePreset,
    accent,
    secondary,
    panelTop,
  );
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style></defs>
  <rect x="0" y="${panelTop}" width="${SIZE}" height="${SIZE - panelTop}" fill="${dark}"/>
  ${motif}
  <text x="64" y="${nameY}" fill="${light}" fill-opacity="0.58" font-size="13" letter-spacing="6" font-family="${ui}">${name}</text>
  ${displayHeadlineSvg({ lines: headLines, x: 64, startY: headStart, fill: light, fontSize: 46, lineHeight: 50, fontFamily: display })}
  ${supports}
  <text x="64" y="${ctaY}" fill="${accent}" font-size="21" letter-spacing="0.5" font-family="${ui}">${cta}</text>
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
  ctaLabel: string;
  stylePreset: SocialStylePreset;
  typeKit: BrandTypeKit;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 42).toUpperCase());
  const headline = layoutHeadline(
    params.title,
    params.captionLine,
    "Einladung",
  );
  const headLines = wrapLayoutLines(headline, 18, 2);
  const support = layoutSupportingLine(params.captionLine, headline);
  const supportLines = wrapLayoutLines(support, 34, 3).map(escapeXml);
  const accent = escapeXml(params.accent);
  const secondary = escapeXml(params.secondary ?? params.accent);
  const light = escapeXml(params.light);
  const cta = escapeXml((params.ctaLabel.trim() || "Reservieren").slice(0, 28));
  const { css, display, ui, support: supportFace } = params.typeKit;
  const headStart = 480;
  const supportStart = headStart + headLines.length * 62 + 24;
  const captions = supportLines
    .map(
      (line, i) =>
        `<text x="540" y="${supportStart + i * 32}" text-anchor="middle" fill="${light}" fill-opacity="0.84" font-size="23" font-family="${supportFace}">${line}</text>`,
    )
    .join("");
  const ruleY = supportStart + supportLines.length * 32 + 28;
  const frame = brandSoireeFrameSvg({
    stylePreset: params.stylePreset,
    accent,
    secondary,
  });
  const rule = brandSoireeRuleMotifAt(
    params.stylePreset,
    accent,
    secondary,
    ruleY,
  );
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style>
    <linearGradient id="dim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#dim)"/>
  ${frame}
  <text x="540" y="280" text-anchor="middle" fill="${light}" fill-opacity="0.68" font-size="14" letter-spacing="7" font-family="${ui}">${name}</text>
  ${displayHeadlineSvg({ lines: headLines, x: 540, startY: headStart, fill: light, fontSize: 56, lineHeight: 62, fontFamily: display, anchor: "middle" })}
  ${captions}
  ${rule}
  <text x="540" y="${ruleY + 42}" text-anchor="middle" fill="${accent}" font-size="18" letter-spacing="1" font-family="${ui}">${cta} →</text>
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
  ctaLabel: string;
  stylePreset: SocialStylePreset;
  typeKit: BrandTypeKit;
}): Buffer {
  const name = escapeXml(params.restaurantName.slice(0, 42));
  const headline = layoutHeadline(
    params.title,
    params.captionLine,
    params.restaurantName,
  );
  const line = escapeXml(
    (layoutSupportingLine(params.captionLine, headline) ||
      params.captionLine ||
      "Willkommen")
      .slice(0, 72),
  );
  const accent = escapeXml(params.accent);
  const secondary = escapeXml(params.secondary ?? params.accent);
  const dark = escapeXml(params.dark);
  const light = escapeXml(params.light);
  const cta = escapeXml((params.ctaLabel.trim() || "Reservieren").slice(0, 28));
  const { css, display, displayItalic, ui } = params.typeKit;
  const wash = params.hasPhoto
    ? `<rect width="${SIZE}" height="${SIZE}" fill="${light}" fill-opacity="0.94"/>`
    : `<rect width="${SIZE}" height="${SIZE}" fill="${light}"/>`;
  const mark = params.hideMarkCircle
    ? ""
    : `<circle cx="540" cy="316" r="44" fill="${secondary}" fill-opacity="0.18" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.25"/>`;
  const motif = brandMotifSvg({
    stylePreset: params.stylePreset,
    accent,
    secondary,
    placement: "signature_rule",
  });
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs><style type="text/css"><![CDATA[${css}]]></style></defs>
  ${wash}
  ${mark}
  <text x="540" y="460" text-anchor="middle" fill="${dark}" font-size="52" font-family="${display}">${name}</text>
  ${motif}
  <text x="540" y="580" text-anchor="middle" fill="${dark}" fill-opacity="0.88" font-size="28" font-style="italic" font-family="${displayItalic}">${line}</text>
  <text x="540" y="700" text-anchor="middle" fill="${accent}" font-size="18" letter-spacing="1" font-family="${ui}">${cta} →</text>
</svg>`;
  return Buffer.from(svg);
}

/**
 * Atelier: photo as inset designed asset on brand canvas (not raw crop + bar).
 */
async function composeAtelierCanvas(params: {
  photo: Buffer;
  photoLook: SocialPhotoLook;
  dark: string;
  accent: string;
  secondary: string | null;
  light: string;
  restaurantName: string;
  title: string | null;
  captionLine: string;
  ctaLabel: string;
  logoMark: Buffer | null;
  stylePreset: SocialStylePreset;
  typeKit: BrandTypeKit;
}): Promise<Buffer> {
  const margin = 40;
  const photoH = Math.round(SIZE * 0.54);
  const photoW = SIZE - margin * 2;
  const graded = await preparePhotoBase(params.photo, params.photoLook);
  const inset = await sharp(graded)
    .resize(photoW, photoH, { fit: "cover", position: "attention" })
    .jpeg({ quality: 93, mozjpeg: true })
    .toBuffer();

  const canvas = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 3,
      background: params.dark,
    },
  })
    .jpeg()
    .toBuffer();

  const overlay = premiumAtelierOverlay({
    accent: params.accent,
    secondary: params.secondary,
    dark: params.dark,
    light: params.light,
    restaurantName: params.restaurantName,
    title: params.title,
    captionLine: params.captionLine,
    ctaLabel: params.ctaLabel,
    photoBandBottom: margin + photoH + 8,
    stylePreset: params.stylePreset,
    typeKit: params.typeKit,
  });

  return sharp(canvas)
    .composite([
      { input: inset, top: margin, left: margin },
      { input: overlay, top: 0, left: 0 },
      ...logoComposite(params.logoMark, "atelier_split"),
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

async function renderPremiumFeedLayout(params: {
  sb: SupabaseClient;
  restaurantId: string;
  feedLayout: SocialFeedLayoutId;
  feedPalette: SocialFeedPalette;
  photoLook: SocialPhotoLook;
  stylePreset?: SocialStylePreset;
  displayFont?: SocialDisplayFontId;
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
  const stylePreset = params.stylePreset ?? "schlicht";
  const typeKit = brandTypeKit(params.displayFont ?? "noto_serif");
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
      ctaLabel: params.ctaLabel,
      stylePreset,
      typeKit,
    });
    return sharp(base)
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...logoComposite(logoMark, "signature_brand"),
      ])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }

  if (params.feedLayout === "atelier_split") {
    return composeAtelierCanvas({
      photo,
      photoLook: params.photoLook,
      dark,
      accent,
      secondary,
      light,
      restaurantName: params.restaurantName,
      title: params.title,
      captionLine,
      ctaLabel: params.ctaLabel,
      logoMark,
      stylePreset,
      typeKit,
    });
  }

  const base = await preparePhotoBase(photo, params.photoLook);

  if (params.feedLayout === "soiree_event") {
    const overlay = premiumSoireeOverlay({
      accent,
      secondary,
      light,
      restaurantName: params.restaurantName,
      title: params.title,
      captionLine,
      ctaLabel: params.ctaLabel,
      stylePreset,
      typeKit,
    });
    return sharp(base)
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...logoComposite(logoMark, "soiree_event"),
      ])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }

  const overlay = premiumEditorialOverlay({
    accent,
    secondary,
    restaurantName: params.restaurantName,
    title: params.title,
    captionLine,
    ctaLabel: params.ctaLabel,
    stylePreset,
    typeKit,
  });
  return sharp(base)
    .composite([
      { input: overlay, top: 0, left: 0 },
      ...logoComposite(logoMark, "editorial_hero"),
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/**
 * Offline / smoke: render from buffers without Supabase (tests + local QA).
 */
export async function renderPremiumFeedLayoutFromBuffers(params: {
  feedLayout: SocialFeedLayoutId;
  feedPalette?: SocialFeedPalette;
  photoLook?: SocialPhotoLook;
  stylePreset?: SocialStylePreset;
  displayFont?: SocialDisplayFontId;
  restaurantName: string;
  title: string | null;
  caption: string;
  photo: Buffer;
  logo?: Buffer | null;
  ctaLabel?: string;
  overlayLine?: string | null;
}): Promise<Buffer> {
  const kit = params.feedPalette ?? DEFAULT_SOCIAL_FEED_PALETTE;
  const accent = normalizeHex(kit.accent) ?? DEFAULT_SOCIAL_FEED_PALETTE.accent;
  const dark =
    normalizeHex(kit.surfaceDark) ?? DEFAULT_SOCIAL_FEED_PALETTE.surfaceDark;
  const light =
    normalizeHex(kit.surfaceLight) ?? DEFAULT_SOCIAL_FEED_PALETTE.surfaceLight;
  const secondary = kit.secondary
    ? (normalizeHex(kit.secondary) ?? null)
    : null;
  const photoLook = params.photoLook ?? "warm";
  const stylePreset = params.stylePreset ?? "schlicht";
  const typeKit = brandTypeKit(params.displayFont ?? "noto_serif");
  const cta = params.ctaLabel?.trim() || "Tisch reservieren";
  const captionLine =
    params.overlayLine?.trim() ||
    overlayLineFromCaption(params.caption, { cta }) ||
    "";
  const logoMark = params.logo
    ? await makeLogoBadge(params.logo)
    : null;

  if (params.feedLayout === "atelier_split") {
    return composeAtelierCanvas({
      photo: params.photo,
      photoLook,
      dark,
      accent,
      secondary,
      light,
      restaurantName: params.restaurantName,
      title: params.title,
      captionLine,
      ctaLabel: cta,
      logoMark,
      stylePreset,
      typeKit,
    });
  }

  const base = await preparePhotoBase(params.photo, photoLook);

  if (params.feedLayout === "signature_brand") {
    const overlay = premiumSignatureOverlay({
      accent,
      secondary,
      dark,
      light,
      restaurantName: params.restaurantName,
      title: params.title,
      captionLine: captionLine || params.caption,
      hasPhoto: true,
      hideMarkCircle: Boolean(logoMark),
      ctaLabel: cta,
      stylePreset,
      typeKit,
    });
    return sharp(base)
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...logoComposite(logoMark, "signature_brand"),
      ])
      .jpeg({ quality: 92, mozjpeg: true })
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
      ctaLabel: cta,
      stylePreset,
      typeKit,
    });
    return sharp(base)
      .composite([
        { input: overlay, top: 0, left: 0 },
        ...logoComposite(logoMark, "soiree_event"),
      ])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }

  const overlay = premiumEditorialOverlay({
    accent,
    secondary,
    restaurantName: params.restaurantName,
    title: params.title,
    captionLine,
    ctaLabel: cta,
    stylePreset,
    typeKit,
  });
  return sharp(base)
    .composite([
      { input: overlay, top: 0, left: 0 },
      ...logoComposite(logoMark, "editorial_hero"),
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

/** Rendert Premium-Feed-Layout (Master 1:1) und lädt es; optional Crop auf Ziel-Format. */
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
  stylePreset?: SocialStylePreset;
  displayFont?: SocialDisplayFontId;
  overlayLine?: string | null;
  /** Ohne LLM: Master croppen auf Plattform-Format. */
  formatId?: SocialMediaFormatId | null;
}): Promise<
  | {
      ok: true;
      imageUrl: string;
      storagePath: string;
      width: number;
      height: number;
      formatId: SocialMediaFormatId;
    }
  | { ok: false; error: string }
> {
  try {
    const master = await renderPremiumFeedLayout({
      sb: params.sb,
      restaurantId: params.restaurantId,
      feedLayout: params.feedLayout,
      feedPalette: params.feedPalette ?? DEFAULT_SOCIAL_FEED_PALETTE,
      photoLook: params.photoLook ?? "warm",
      stylePreset: params.stylePreset,
      displayFont: params.displayFont,
      restaurantName: params.restaurantName,
      title: params.title,
      caption: params.caption,
      asset: params.asset,
      ctaLabel: params.ctaLabel?.trim() || "Reservieren",
      overlayLine: params.overlayLine,
    });
    const formatId = params.formatId ?? "square_1x1";
    const format = SOCIAL_MEDIA_FORMATS[formatId];
    const jpeg =
      formatId === "square_1x1"
        ? master
        : await adaptSocialImageToFormat(master, formatId);
    const storagePath = `${params.restaurantId}/social-autopilot/${params.suggestionId}/${formatId}-${randomUUID()}.jpg`;
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
    return {
      ok: true,
      imageUrl: data.signedUrl,
      storagePath,
      width: format.width,
      height: format.height,
      formatId,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "render_failed";
    console.warn("[gwada] renderAndUploadSocialTemplate", message);
    return { ok: false, error: message };
  }
}
