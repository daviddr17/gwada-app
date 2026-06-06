export const SWIPE_CLOSE_OFFSET_PX = 96;
export const SWIPE_CLOSE_VELOCITY = 720;
/** Velocity allein schließt nur, wenn schon sichtbar nach unten gezogen wurde. */
export const SWIPE_CLOSE_MIN_OFFSET_FOR_VELOCITY_PX = 48;
export const DRAG_TO_ICON_RANGE_PX = 380;
export const DRAG_REVEAL_ICON_PROGRESS = 0.18;

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
