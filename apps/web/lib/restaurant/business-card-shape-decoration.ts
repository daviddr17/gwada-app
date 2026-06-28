import {
  BUSINESS_CARD_DECORATION_MINS,
  clampBusinessCardRect,
  createBusinessCardDecorationId,
  type BusinessCardDecoration,
  type BusinessCardFormatId,
  type BusinessCardRect,
  type BusinessCardSide,
} from "@/lib/restaurant/business-card-design";
import { normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

export type BusinessCardShapeKind = "rect" | "circle" | "line";

export const BUSINESS_CARD_SHAPE_DRAG_MIME = "application/x-gwada-bc-shape";

export type BusinessCardShapeDecoration = {
  id: string;
  side: BusinessCardSide;
  rect: BusinessCardRect;
  kind: BusinessCardShapeKind;
  color: string;
  /** 0–1 */
  opacity: number;
  /** Rechteck / Kreis */
  filled: boolean;
  /** Strichstärke (relativ, ~1–6) */
  lineWidth: number;
};

export type BusinessCardImageDecoration = {
  id: string;
  side: BusinessCardSide;
  rect: BusinessCardRect;
  kind?: "image";
  fileName: string;
  format: "PNG" | "JPEG";
  dataUrl?: string;
  documentId?: string;
  /** 0–1, Standard 1 */
  opacity?: number;
};

export type BusinessCardDecorationItem =
  | BusinessCardImageDecoration
  | BusinessCardShapeDecoration;

export const BUSINESS_CARD_SHAPE_OPTIONS: Array<{
  kind: BusinessCardShapeKind;
  label: string;
  description: string;
}> = [
  { kind: "rect", label: "Rechteck", description: "Fläche oder Rahmen" },
  { kind: "circle", label: "Kreis", description: "Oval oder Ring" },
  { kind: "line", label: "Linie", description: "Horizontale Trennlinie" },
];

const LINE_MINS = { minW: 10, minH: 0.5 };
const CIRCLE_MINS = { minW: 5, minH: 5 };

export function isBusinessCardShapeDecoration(
  decoration: BusinessCardDecoration,
): decoration is BusinessCardShapeDecoration {
  return (
    decoration.kind === "rect"
    || decoration.kind === "circle"
    || decoration.kind === "line"
  );
}

export function isBusinessCardImageDecoration(
  decoration: BusinessCardDecoration,
): decoration is BusinessCardImageDecoration {
  return !isBusinessCardShapeDecoration(decoration);
}

export function businessCardDecorationLabel(decoration: BusinessCardDecoration): string {
  if (isBusinessCardShapeDecoration(decoration)) {
    return (
      BUSINESS_CARD_SHAPE_OPTIONS.find((o) => o.kind === decoration.kind)?.label
      ?? "Form"
    );
  }
  return decoration.fileName;
}

export function decorationClampMins(
  decoration: BusinessCardDecoration,
): { minW: number; minH: number } {
  if (!isBusinessCardShapeDecoration(decoration)) {
    return BUSINESS_CARD_DECORATION_MINS;
  }
  if (decoration.kind === "line") return LINE_MINS;
  if (decoration.kind === "circle") return CIRCLE_MINS;
  return BUSINESS_CARD_DECORATION_MINS;
}

export function defaultShapeDecorationRect(
  kind: BusinessCardShapeKind,
  formatId: BusinessCardFormatId,
  center?: { xPct: number; yPct: number },
): BusinessCardRect {
  const cx = center?.xPct ?? 50;
  const cy = center?.yPct ?? 50;

  if (kind === "line") {
    const w = 42;
    const h = 1.1;
    return clampBusinessCardRect(
      { x: cx - w / 2, y: cy - h / 2, w, h },
      LINE_MINS,
    );
  }

  if (kind === "circle") {
    const w = 14;
    const h = 18;
    return clampBusinessCardRect(
      { x: cx - w / 2, y: cy - h / 2, w, h },
      CIRCLE_MINS,
    );
  }

  const w = 32;
  const h = 14;
  return clampBusinessCardRect(
    { x: cx - w / 2, y: cy - h / 2, w, h },
    BUSINESS_CARD_DECORATION_MINS,
  );
}

export function createBusinessCardShapeDecoration(params: {
  kind: BusinessCardShapeKind;
  side: BusinessCardSide;
  formatId: BusinessCardFormatId;
  accentHex: string;
  dropPosition?: { xPct: number; yPct: number };
}): BusinessCardShapeDecoration {
  const accent = normalizeHex(params.accentHex) ?? DEFAULT_ACCENT_HEX;
  const isLine = params.kind === "line";

  return {
    id: createBusinessCardDecorationId(),
    side: params.side,
    kind: params.kind,
    color: accent,
    opacity: isLine ? 0.55 : 0.28,
    filled: !isLine,
    lineWidth: isLine ? 2.5 : 1.5,
    rect: defaultShapeDecorationRect(
      params.kind,
      params.formatId,
      params.dropPosition,
    ),
  };
}

export function parseBusinessCardDecorationItem(
  item: unknown,
): BusinessCardDecoration | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  if (raw.side !== "front" && raw.side !== "back") return null;
  if (
    typeof raw.id !== "string"
    || typeof raw.rect !== "object"
    || !raw.rect
  ) {
    return null;
  }
  const rect = raw.rect as BusinessCardRect;
  if (
    typeof rect.x !== "number"
    || typeof rect.y !== "number"
    || typeof rect.w !== "number"
    || typeof rect.h !== "number"
  ) {
    return null;
  }

  if (
    raw.kind === "rect"
    || raw.kind === "circle"
    || raw.kind === "line"
  ) {
    const color =
      typeof raw.color === "string"
        ? raw.color
        : DEFAULT_ACCENT_HEX;
    return {
      id: raw.id,
      side: raw.side,
      rect,
      kind: raw.kind,
      color,
      opacity:
        typeof raw.opacity === "number"
          ? Math.min(1, Math.max(0, raw.opacity))
          : 0.35,
      filled: raw.filled !== false,
      lineWidth:
        typeof raw.lineWidth === "number"
          ? Math.min(8, Math.max(0.5, raw.lineWidth))
          : 2,
    };
  }

  if (
    typeof raw.fileName !== "string"
    || (raw.format !== "PNG" && raw.format !== "JPEG")
  ) {
    return null;
  }

  const documentId =
    typeof raw.documentId === "string" ? raw.documentId.trim() : undefined;
  const dataUrl =
    typeof raw.dataUrl === "string" ? raw.dataUrl.trim() : undefined;
  if (!documentId && !dataUrl) return null;

  return {
    id: raw.id,
    side: raw.side,
    rect,
    fileName: raw.fileName,
    format: raw.format,
    documentId: documentId || undefined,
    dataUrl: dataUrl || undefined,
    opacity:
      typeof raw.opacity === "number"
        ? Math.min(1, Math.max(0, raw.opacity))
        : undefined,
  };
}
