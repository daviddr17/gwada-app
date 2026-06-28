import {
  BUSINESS_CARD_LOGO_IMAGE_INSET_PCT,
  BUSINESS_CARD_LOGO_INNER_SCALE,
  businessCardLogoDisplaySidePx,
  type BusinessCardDesign,
} from "@/lib/restaurant/business-card-design";
import type { BusinessCardLogoStyle } from "@/lib/restaurant/business-card-art-direction";
import { containImageRect } from "@/lib/restaurant/business-card-image-utils";
import { getAccentForeground, normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

const BADGE_SUPERSAMPLE = 3;

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  return name.trim().slice(0, 2).toLocaleUpperCase("de-DE") || "?";
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("logo_image_load_failed"));
    img.src = src;
  });
}

/** Logo-Badge als scharfe PNG — html2canvas rendert Kreis/Padding/Schatten schlecht. */
export async function prepareBusinessCardLogoBadgeForExport(input: {
  logoUrl: string | null;
  initialsName: string;
  design: BusinessCardDesign;
  cardWidthPx: number;
  cardHeightPx: number;
  logoStyle: BusinessCardLogoStyle;
}): Promise<string | null> {
  const logoEl = input.design.elements.find((e) => e.type === "logo" && e.enabled);
  if (!logoEl) return null;

  const sidePx = businessCardLogoDisplaySidePx(
    logoEl.rect,
    input.cardWidthPx,
    input.cardHeightPx,
  );
  if (sidePx < 8) return null;

  const shadowPad = Math.ceil(BADGE_SUPERSAMPLE * 6);
  const innerCanvasSize = Math.max(64, Math.round(sidePx * BADGE_SUPERSAMPLE));
  const size = innerCanvasSize + shadowPad * 2;
  const innerSize = innerCanvasSize * (1 - (2 * BUSINESS_CARD_LOGO_IMAGE_INSET_PCT) / 100);
  const accent = normalizeHex(input.design.colors.accent) ?? DEFAULT_ACCENT_HEX;
  const onAccent = getAccentForeground(accent);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.translate(shadowPad, shadowPad);
  const shapeSize = innerCanvasSize;
  const shapeX = 0;
  const shapeY = 0;

  ctx.shadowColor = "rgba(15, 23, 42, 0.14)";
  ctx.shadowBlur = BADGE_SUPERSAMPLE * 4.5;
  ctx.shadowOffsetY = BADGE_SUPERSAMPLE * 2;
  ctx.fillStyle = "#ffffff";
  fillLogoShape(ctx, shapeX, shapeY, shapeSize, input.logoStyle);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = "rgba(0,0,0,0.06)";
  ctx.lineWidth = Math.max(1, BADGE_SUPERSAMPLE * 0.75);
  strokeLogoShape(ctx, shapeX, shapeY, shapeSize, input.logoStyle);
  ctx.stroke();

  const innerOrigin = (shapeSize - innerSize) / 2;
  ctx.save();
  clipLogoShape(ctx, shapeX + innerOrigin, shapeY + innerOrigin, innerSize, input.logoStyle);

  if (input.logoUrl?.trim()) {
    try {
      const img = await loadHtmlImage(input.logoUrl);
      const { dx, dy, dw, dh } = containImageRect(
        img.naturalWidth,
        img.naturalHeight,
        innerSize,
        innerSize,
      );
      ctx.drawImage(
        img,
        shapeX + innerOrigin + dx,
        shapeY + innerOrigin + dy,
        dw,
        dh,
      );
    } catch {
      drawInitials(
        ctx,
        shapeX + shapeSize / 2,
        shapeY + shapeSize / 2,
        innerSize / 2,
        accent,
        onAccent,
        input.initialsName,
        input.logoStyle,
      );
    }
  } else {
    drawInitials(
      ctx,
      shapeX + shapeSize / 2,
      shapeY + shapeSize / 2,
      innerSize / 2,
      accent,
      onAccent,
      input.initialsName,
      input.logoStyle,
    );
  }

  ctx.restore();

  return canvas.toDataURL("image/png");
}

function squircleRadius(side: number): number {
  return side * 0.22;
}

function fillLogoShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  style: BusinessCardLogoStyle,
): void {
  ctx.beginPath();
  if (style === "squircle") {
    roundRectPath(ctx, x, y, side, side, squircleRadius(side));
  } else {
    ctx.arc(x + side / 2, y + side / 2, side / 2, 0, Math.PI * 2);
  }
}

function strokeLogoShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  style: BusinessCardLogoStyle,
): void {
  ctx.beginPath();
  if (style === "squircle") {
    roundRectPath(ctx, x, y, side, side, squircleRadius(side));
  } else {
    ctx.arc(x + side / 2, y + side / 2, side / 2 - ctx.lineWidth * 0.35, 0, Math.PI * 2);
  }
}

function clipLogoShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  side: number,
  style: BusinessCardLogoStyle,
): void {
  ctx.beginPath();
  if (style === "squircle") {
    roundRectPath(ctx, x, y, side, side, squircleRadius(side));
  } else {
    ctx.arc(x + side / 2, y + side / 2, side / 2, 0, Math.PI * 2);
  }
  ctx.clip();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawInitials(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  accent: string,
  onAccent: string,
  name: string,
  style: BusinessCardLogoStyle,
) {
  ctx.fillStyle = accent;
  ctx.beginPath();
  if (style === "squircle") {
    const side = radius * 2;
    roundRectPath(ctx, cx - radius, cy - radius, side, side, squircleRadius(side));
  } else {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  ctx.fill();

  const initials = restaurantInitials(name).slice(0, 2);
  ctx.fillStyle = onAccent;
  ctx.font = `600 ${Math.round(radius * 0.72)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, cx, cy + radius * 0.04);
}
