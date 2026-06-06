import { useEffect, useRef, type RefObject } from "react";
import type { useMotionValue } from "framer-motion";
import { shouldDismissSheetPull } from "@/lib/public-profile/profile-sheet-gesture-constants";
import { isIgnoredProfileSheetGestureTarget } from "@/lib/public-profile/profile-sheet-gesture-targets";

const PULL_ACTIVATE_PX = 12;
const PULL_CANCEL_UP_PX = 14;
const PULL_VELOCITY_MIN_DT_MS = 8;
const PULL_VELOCITY_SAMPLE_MAX = 5;

type MotionValues = {
  x: ReturnType<typeof useMotionValue<number>>;
  y: ReturnType<typeof useMotionValue<number>>;
  scale: ReturnType<typeof useMotionValue<number>>;
  radius: ReturnType<typeof useMotionValue<number>>;
  contentOpacity: ReturnType<typeof useMotionValue<number>>;
  backdropOpacity: ReturnType<typeof useMotionValue<number>>;
};

type SheetContentGesturesConfig = {
  scrollRef: RefObject<HTMLElement | null>;
  /** Re-bind listeners when the scroll root element changes (e.g. module pager). */
  scrollKey?: string;
  enabled: boolean;
  getScrollTop: () => number;
  dragRevealProgress: number;
  dragRangePx: number;
  applyDrag: (offsetY: number, values: MotionValues) => number;
  dragMotionValues: MotionValues;
  dragRevealStartedRef: RefObject<boolean>;
  onDragRevealIcon: () => void;
  snapOpen: () => void;
  dismissToIcon: () => void;
};

function isScrollAtTop(getScrollTop: () => number) {
  return getScrollTop() <= 1;
}

/** Pull-down zum Schließen; horizontales Modul-Paging separat (Touch). */
export function useProfileSheetContentGestures({
  scrollRef,
  scrollKey,
  enabled,
  getScrollTop,
  dragRevealProgress,
  dragRangePx,
  applyDrag,
  dragMotionValues,
  dragRevealStartedRef,
  onDragRevealIcon,
  snapOpen,
  dismissToIcon,
}: SheetContentGesturesConfig) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const snapOpenRef = useRef(snapOpen);
  snapOpenRef.current = snapOpen;
  const dismissRef = useRef(dismissToIcon);
  dismissRef.current = dismissToIcon;
  const onRevealRef = useRef(onDragRevealIcon);
  onRevealRef.current = onDragRevealIcon;
  const applyDragRef = useRef(applyDrag);
  applyDragRef.current = applyDrag;
  const getScrollTopRef = useRef(getScrollTop);
  getScrollTopRef.current = getScrollTop;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !enabled) return;

    let startY = 0;
    let verticalActive = false;
    let touchTracking = false;
    let pointerTracking = false;
    let lastY = 0;
    let lastT = 0;
    let velocityY = 0;
    let velocitySamples: number[] = [];
    let scrolledContentDuringGesture = false;

    const resetGesture = () => {
      verticalActive = false;
      touchTracking = false;
      pointerTracking = false;
      velocityY = 0;
      velocitySamples = [];
      scrolledContentDuringGesture = false;
    };

    const revealIfNeeded = (progress: number) => {
      if (
        progress >= dragRevealProgress &&
        !dragRevealStartedRef.current
      ) {
        dragRevealStartedRef.current = true;
        onRevealRef.current();
      }
    };

    const applyPull = (offsetY: number) => {
      if (!enabledRef.current) return 0;
      const clamped = Math.min(Math.max(offsetY, 0), dragRangePx);
      const progress = applyDragRef.current(clamped, dragMotionValues);
      revealIfNeeded(progress);
      return clamped;
    };

    const finishPull = (offsetY: number, velocity: number) => {
      if (
        shouldDismissSheetPull(
          offsetY,
          velocity,
          scrolledContentDuringGesture,
        )
      ) {
        dismissRef.current();
        return;
      }
      snapOpenRef.current();
    };

    const trackVelocity = (y: number) => {
      const now = performance.now();
      const dt = Math.max(now - lastT, PULL_VELOCITY_MIN_DT_MS);
      velocitySamples.push(((y - lastY) / dt) * 1000);
      if (velocitySamples.length > PULL_VELOCITY_SAMPLE_MAX) {
        velocitySamples.shift();
      }
      velocityY =
        velocitySamples.reduce((sum, sample) => sum + sample, 0) /
        velocitySamples.length;
      lastY = y;
      lastT = now;
    };

    const handleVerticalPullMove = (dy: number, preventDefault: () => void) => {
      if (!verticalActive && getScrollTopRef.current() > 0) {
        scrolledContentDuringGesture = true;
        return "scroll";
      }

      if (isScrollAtTop(getScrollTopRef.current) && dy > PULL_ACTIVATE_PX) {
        scrolledContentDuringGesture = false;
      }

      if (!verticalActive) {
        if (!isScrollAtTop(getScrollTopRef.current) || dy <= PULL_ACTIVATE_PX) {
          return "none";
        }
        verticalActive = true;
      }

      if (dy <= 0) {
        if (verticalActive) {
          applyPull(0);
          if (dy < -PULL_CANCEL_UP_PX) {
            verticalActive = false;
          }
        }
        return "none";
      }

      preventDefault();
      applyPull(dy);
      return "pull";
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!enabledRef.current || isIgnoredProfileSheetGestureTarget(event.target)) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      touchTracking = true;
      startY = touch.clientY;
      lastY = startY;
      lastT = performance.now();
      verticalActive = false;
      velocityY = 0;
      velocitySamples = [];
      scrolledContentDuringGesture = getScrollTopRef.current() > 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!enabledRef.current || !touchTracking) return;
      const touch = event.touches[0];
      if (!touch) return;

      if (getScrollTopRef.current() > 0) {
        scrolledContentDuringGesture = true;
      }

      const y = touch.clientY;
      const dy = y - startY;
      trackVelocity(y);

      if (
        !verticalActive &&
        isScrollAtTop(getScrollTopRef.current) &&
        dy > PULL_ACTIVATE_PX &&
        scrolledContentDuringGesture
      ) {
        startY = y - PULL_ACTIVATE_PX;
        scrolledContentDuringGesture = false;
      }

      const result = handleVerticalPullMove(dy, () => {
        event.preventDefault();
      });
      if (result === "scroll") {
        startY = y;
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!touchTracking) return;
      const touch = event.changedTouches[0];
      if (!touch) {
        resetGesture();
        return;
      }

      if (verticalActive) {
        const dy = Math.max(0, touch.clientY - startY);
        finishPull(dy, velocityY);
      }

      resetGesture();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!enabledRef.current || event.button !== 0) return;
      if (event.pointerType === "touch") return;
      if (isIgnoredProfileSheetGestureTarget(event.target)) return;
      pointerTracking = true;
      startY = event.clientY;
      lastY = startY;
      lastT = performance.now();
      verticalActive = false;
      velocityY = 0;
      velocitySamples = [];
      scrolledContentDuringGesture = getScrollTopRef.current() > 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!enabledRef.current || event.pointerType === "touch" || !pointerTracking) {
        return;
      }
      if (event.buttons !== 1 && !verticalActive) return;

      if (getScrollTopRef.current() > 0) {
        scrolledContentDuringGesture = true;
      }

      const dy = event.clientY - startY;
      trackVelocity(event.clientY);

      if (
        !verticalActive &&
        isScrollAtTop(getScrollTopRef.current) &&
        dy > PULL_ACTIVATE_PX &&
        scrolledContentDuringGesture
      ) {
        startY = event.clientY - PULL_ACTIVATE_PX;
        scrolledContentDuringGesture = false;
      }

      const wasVertical = verticalActive;
      const result = handleVerticalPullMove(dy, () => {
        event.preventDefault();
      });
      if (result === "scroll") {
        startY = event.clientY;
      }
      if (!wasVertical && verticalActive) {
        el.setPointerCapture(event.pointerId);
      }
      if (wasVertical && !verticalActive && el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
    };

    const finishPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !pointerTracking) return;

      if (verticalActive) {
        const dy = Math.max(0, event.clientY - startY);
        finishPull(dy, velocityY);
      }

      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      resetGesture();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!pointerTracking || !verticalActive) return;
      finishPointer(event);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !pointerTracking) return;
      if (verticalActive) snapOpenRef.current();
      if (el.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      resetGesture();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [
    scrollRef,
    scrollKey,
    enabled,
    dragRevealProgress,
    dragRangePx,
    dragMotionValues,
    dragRevealStartedRef,
  ]);
}
