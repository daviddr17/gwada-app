export const SWIPE_CLOSE_OFFSET_PX = 96;
export const SWIPE_CLOSE_VELOCITY = 720;
/** Velocity allein schließt nur, wenn schon sichtbar nach unten gezogen wurde. */
export const SWIPE_CLOSE_MIN_OFFSET_FOR_VELOCITY_PX = 48;
export const DRAG_TO_ICON_RANGE_PX = 380;
/** Drag-Fortschritt (0–1), ab dem das Launcher-Icon sichtbar wird. */
export const DRAG_REVEAL_ICON_PROGRESS = 0.14;
/** Morph startet erst nach diesem Anteil der Drag-Range — Y bleibt davor linear. */
export const SHEET_DRAG_MORPH_START = 0.26;

/** Smoothstep-Morph: langsam einsteigen, ohne Ruckler am Anfang. */
export function sheetDragMorphStrength(dragProgress: number): number {
  const p = Math.min(Math.max(dragProgress, 0), 1);
  if (p <= SHEET_DRAG_MORPH_START) return 0;
  const t = (p - SHEET_DRAG_MORPH_START) / (1 - SHEET_DRAG_MORPH_START);
  return t * t * (3 - 2 * t);
}

export function shouldDismissSheetPull(
  offsetY: number,
  velocityY: number,
  scrolledContentDuringGesture: boolean,
): boolean {
  if (offsetY > SWIPE_CLOSE_OFFSET_PX) return true;

  if (offsetY < SWIPE_CLOSE_MIN_OFFSET_FOR_VELOCITY_PX) return false;
  if (velocityY <= 0) return false;

  if (scrolledContentDuringGesture) {
    return (
      offsetY >= SWIPE_CLOSE_MIN_OFFSET_FOR_VELOCITY_PX * 1.2 &&
      velocityY > SWIPE_CLOSE_VELOCITY * 1.08
    );
  }

  return velocityY > SWIPE_CLOSE_VELOCITY;
}
