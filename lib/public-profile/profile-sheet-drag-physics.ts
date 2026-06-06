import type { MotionValue } from "framer-motion";
import {
  DRAG_TO_ICON_RANGE_PX,
  sheetDragMorphStrength,
} from "@/lib/public-profile/profile-sheet-gesture-constants";

export const IOS_SHEET_OPEN_RADIUS_PX = 44;

export type SheetRestLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type IconMorphTargets = {
  targetX: number;
  targetY: number;
  targetScale: number;
  targetRadius: number;
};

export type SheetDragMotionValues = {
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  radius: MotionValue<number>;
  contentOpacity: MotionValue<number>;
  backdropOpacity: MotionValue<number>;
};

export type HybridSheetDragResult = {
  dragProgress: number;
  morphProgress: number;
};

export function captureSheetRestLayout(sheetEl: HTMLElement): SheetRestLayout {
  const rect = sheetEl.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: sheetEl.offsetWidth,
    height: sheetEl.offsetHeight,
  };
}

export function computeIconMorphTargets(
  restLayout: SheetRestLayout,
  iconRect: DOMRect,
): IconMorphTargets {
  const sheetCx = restLayout.left + restLayout.width / 2;
  const sheetCy = restLayout.top + restLayout.height / 2;
  const iconCx = iconRect.left + iconRect.width / 2;
  const iconCy = iconRect.top + iconRect.height / 2;

  return {
    targetX: iconCx - sheetCx,
    targetY: iconCy - sheetCy,
    targetScale: iconRect.width / restLayout.width,
    targetRadius: iconRect.width * 0.22,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Sheet follows finger 1:1 on Y; morph (scale, x, radius, opacity) ramps on a separate eased curve. */
export function applyHybridSheetDrag(
  offsetY: number,
  restLayout: SheetRestLayout | null,
  iconRect: DOMRect | null,
  values: SheetDragMotionValues,
): HybridSheetDragResult {
  const dragProgress = clamp(offsetY / DRAG_TO_ICON_RANGE_PX, 0, 1);
  const morph = sheetDragMorphStrength(dragProgress);

  values.y.set(offsetY);

  if (!iconRect || !restLayout) {
    values.x.set(0);
    values.scale.set(1 - morph * 0.18);
    values.radius.set(IOS_SHEET_OPEN_RADIUS_PX - morph * 22);
    values.contentOpacity.set(1 - morph * 0.42);
    values.backdropOpacity.set(1 - morph * 0.48);
    return { dragProgress, morphProgress: morph };
  }

  const { targetX, targetScale, targetRadius } = computeIconMorphTargets(
    restLayout,
    iconRect,
  );

  values.x.set(targetX * morph);
  values.scale.set(1 - morph * (1 - targetScale));
  values.radius.set(
    IOS_SHEET_OPEN_RADIUS_PX -
      morph * (IOS_SHEET_OPEN_RADIUS_PX - targetRadius),
  );
  values.contentOpacity.set(1 - morph * 0.72);
  values.backdropOpacity.set(1 - morph * 0.58);

  return { dragProgress, morphProgress: morph };
}

export function hybridDragMorphProgress(offsetY: number): number {
  const dragProgress = clamp(offsetY / DRAG_TO_ICON_RANGE_PX, 0, 1);
  return sheetDragMorphStrength(dragProgress);
}

export function sheetTransformOriginFromLayout(
  restLayout: SheetRestLayout,
  iconRect: DOMRect,
): string {
  const iconCx = iconRect.left + iconRect.width / 2;
  const iconCy = iconRect.top + iconRect.height / 2;
  const originX = clamp(
    ((iconCx - restLayout.left) / restLayout.width) * 100,
    6,
    94,
  );
  const originY = clamp(
    ((iconCy - restLayout.top) / restLayout.height) * 100,
    6,
    94,
  );
  return `${originX}% ${originY}%`;
}
