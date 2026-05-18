/** Mindest-/Höchstmaße für Tisch-Kästen auf dem Plan (Anteil der Canvas-Kante, 0–100). */
export const FLOOR_PLAN_TABLE_MIN_W_PCT = 6;
export const FLOOR_PLAN_TABLE_MIN_H_PCT = 8;
export const FLOOR_PLAN_TABLE_MAX_W_PCT = 65;
export const FLOOR_PLAN_TABLE_MAX_H_PCT = 50;

export type FloorResizeCorner = "nw" | "ne" | "sw" | "se";

export function clampPct(n: number): number {
  return Math.min(100, Math.max(0, n));
}

export function clientToCanvasPct(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  return {
    x: clampPct(((clientX - rect.left) / Math.max(1, rect.width)) * 100),
    y: clampPct(((clientY - rect.top) / Math.max(1, rect.height)) * 100),
  };
}

/** Gegenüberliegende Ecke / Anker für Größenänderung (in %-Koordinaten der Canvas). */
export function anchorForResizeCorner(
  corner: FloorResizeCorner,
  cx: number,
  cy: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const left = cx - w / 2;
  const right = cx + w / 2;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  switch (corner) {
    case "se":
      return { x: left, y: top };
    case "nw":
      return { x: right, y: bottom };
    case "ne":
      return { x: left, y: bottom };
    case "sw":
      return { x: right, y: top };
  }
}

export function computeResizedTableRect(
  corner: FloorResizeCorner,
  anchorX: number,
  anchorY: number,
  pointerX: number,
  pointerY: number,
): { cx: number; cy: number; w: number; h: number } {
  let w: number;
  let h: number;
  let cx: number;
  let cy: number;
  switch (corner) {
    case "se": {
      w = pointerX - anchorX;
      h = pointerY - anchorY;
      cx = anchorX + w / 2;
      cy = anchorY + h / 2;
      break;
    }
    case "nw": {
      w = anchorX - pointerX;
      h = anchorY - pointerY;
      cx = anchorX - w / 2;
      cy = anchorY - h / 2;
      break;
    }
    case "ne": {
      w = pointerX - anchorX;
      h = anchorY - pointerY;
      cx = anchorX + w / 2;
      cy = anchorY - h / 2;
      break;
    }
    case "sw": {
      w = anchorX - pointerX;
      h = pointerY - anchorY;
      cx = anchorX - w / 2;
      cy = anchorY + h / 2;
      break;
    }
  }
  w = Math.min(FLOOR_PLAN_TABLE_MAX_W_PCT, Math.max(FLOOR_PLAN_TABLE_MIN_W_PCT, w));
  h = Math.min(FLOOR_PLAN_TABLE_MAX_H_PCT, Math.max(FLOOR_PLAN_TABLE_MIN_H_PCT, h));
  cx = Math.min(100 - w / 2, Math.max(w / 2, cx));
  cy = Math.min(100 - h / 2, Math.max(h / 2, cy));
  return { cx, cy, w, h };
}

const HEX6 = /^#([0-9a-fA-F]{6})$/;

export function parseTableHex(hex: string | null | undefined): string | null {
  if (!hex || !HEX6.test(hex)) return null;
  return hex;
}

/** Einfache Luminanz für Lesetext auf Tischfarbe. */
export function tablePlanTextClass(hex: string | null | undefined): string {
  const h = parseTableHex(hex);
  if (!h) return "text-foreground";
  const m = HEX6.exec(h);
  if (!m) return "text-foreground";
  const s = m[1];
  const r = Number.parseInt(s.slice(0, 2), 16);
  const g = Number.parseInt(s.slice(2, 4), 16);
  const b = Number.parseInt(s.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "text-slate-900" : "text-white";
}

export function tablePlanMutedClass(hex: string | null | undefined): string {
  const h = parseTableHex(hex);
  if (!h) return "text-muted-foreground";
  const m = HEX6.exec(h);
  if (!m) return "text-muted-foreground";
  const s = m[1];
  const r = Number.parseInt(s.slice(0, 2), 16);
  const g = Number.parseInt(s.slice(2, 4), 16);
  const b = Number.parseInt(s.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "text-slate-700" : "text-white/85";
}

/** Schrift und Steuerelemente an Tischgröße (Canvas-%) — kleine Tische bleiben lesbar. */
export type FloorPlanTableUiScale = {
  labelPx: number;
  sublabelPx: number;
  iconPx: number;
  actionBtnPx: number;
  resizeHandlePx: number;
  contentPadPx: number;
  toolbarPadYPx: number;
  toolbarGapPx: number;
  contentGapPx: number;
  /** Kapazitätszeile ausblenden, wenn kaum Platz in der Höhe */
  showCapacity: boolean;
};

export function floorPlanTableUiScale(wPct: number, hPct: number): FloorPlanTableUiScale {
  const m = Math.min(wPct, hPct);
  /** 0 = sehr klein (Mindestmaße), 1 = groß genug für Standard-UI */
  const t = Math.max(0, Math.min(1, (m - 6) / 16));
  const labelPx = Math.round(7 + t * 5);
  const sublabelPx = Math.round(5 + t * 5);
  const iconPx = Math.round(8 + t * 6);
  const actionBtnPx = Math.round(18 + t * 10);
  const resizeHandlePx = Math.round(9 + t * 5);
  const contentPadPx = Math.round(1 + t * 4);
  const toolbarPadYPx = Math.round(2 + t * 3);
  const toolbarGapPx = Math.max(0, Math.round(t * 2));
  const contentGapPx = Math.max(0, Math.round(1 + t * 2));
  const showCapacity = m >= 9;
  return {
    labelPx,
    sublabelPx,
    iconPx,
    actionBtnPx,
    resizeHandlePx,
    contentPadPx,
    toolbarPadYPx,
    toolbarGapPx,
    contentGapPx,
    showCapacity,
  };
}
