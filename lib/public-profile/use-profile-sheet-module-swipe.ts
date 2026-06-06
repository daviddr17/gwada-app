import { animate, type MotionValue } from "framer-motion";
import { useEffect, useRef, type RefObject } from "react";
import type { ProfileAppId } from "@/lib/public-profile/profile-app-config";
import {
  MODULE_SWIPE_ACTIVATE_PX,
  MODULE_SWIPE_AXIS_RATIO,
  MODULE_SWIPE_EDGE_RESISTANCE,
  shouldCommitProfileModuleSwipe,
} from "@/lib/public-profile/profile-sheet-gesture-constants";
import {
  isIgnoredProfileSheetModuleSwipeTarget,
  shouldDeferToProfileSheetHorizontalScroll,
} from "@/lib/public-profile/profile-sheet-gesture-targets";
import { IOS_APP_PAGER_SNAP_TRANSITION } from "@/lib/public-profile/profile-app-motion";

const SWIPE_VELOCITY_MIN_DT_MS = 8;
const SWIPE_VELOCITY_SAMPLE_MAX = 5;

type ModuleSwipeConfig = {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  appIds: ProfileAppId[];
  activeApp: ProfileAppId;
  onSwitchApp: (appId: ProfileAppId) => void;
  panX: MotionValue<number>;
};

/** Horizontales Modul-Paging — nur Touch, mit Finger-Follow und Snappy-Snap. */
export function useProfileSheetModuleSwipe({
  containerRef,
  enabled,
  appIds,
  activeApp,
  onSwitchApp,
  panX,
}: ModuleSwipeConfig) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const appIdsRef = useRef(appIds);
  appIdsRef.current = appIds;

  const activeAppRef = useRef(activeApp);
  activeAppRef.current = activeApp;

  const onSwitchRef = useRef(onSwitchApp);
  onSwitchRef.current = onSwitchApp;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocityX = 0;
    let velocitySamples: number[] = [];
    let lockedAxis: "horizontal" | "vertical" | null = null;
    let horizontalActive = false;
    let touchTracking = false;
    let deferToNativeScroll = false;

    const resetGesture = () => {
      lockedAxis = null;
      horizontalActive = false;
      touchTracking = false;
      deferToNativeScroll = false;
      velocityX = 0;
      velocitySamples = [];
    };

    const trackVelocity = (x: number) => {
      const now = performance.now();
      const dt = Math.max(now - lastT, SWIPE_VELOCITY_MIN_DT_MS);
      velocitySamples.push(((x - lastX) / dt) * 1000);
      if (velocitySamples.length > SWIPE_VELOCITY_SAMPLE_MAX) {
        velocitySamples.shift();
      }
      velocityX =
        velocitySamples.reduce((sum, sample) => sum + sample, 0) /
        velocitySamples.length;
      lastX = x;
      lastT = now;
    };

    const applyHorizontalOffset = (dx: number) => {
      const ids = appIdsRef.current;
      const idx = ids.indexOf(activeAppRef.current);
      let offset = dx;

      if (idx <= 0 && offset > 0) {
        offset *= MODULE_SWIPE_EDGE_RESISTANCE;
      }
      if (idx >= ids.length - 1 && offset < 0) {
        offset *= MODULE_SWIPE_EDGE_RESISTANCE;
      }

      panX.set(offset);
    };

    const finishHorizontalSwipe = (dx: number) => {
      const ids = appIdsRef.current;
      const idx = ids.indexOf(activeAppRef.current);
      const commit = shouldCommitProfileModuleSwipe(
        dx,
        velocityX,
        el.offsetWidth,
      );

      if (commit === -1 && idx < ids.length - 1) {
        panX.set(0);
        onSwitchRef.current(ids[idx + 1]!);
        return;
      }

      if (commit === 1 && idx > 0) {
        panX.set(0);
        onSwitchRef.current(ids[idx - 1]!);
        return;
      }

      void animate(panX, 0, IOS_APP_PAGER_SNAP_TRANSITION);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (
        !enabledRef.current ||
        isIgnoredProfileSheetModuleSwipeTarget(event.target)
      ) {
        return;
      }

      const touch = event.touches[0];
      if (!touch) return;

      touchTracking = true;
      startX = touch.clientX;
      startY = touch.clientY;
      lastX = startX;
      lastT = performance.now();
      lockedAxis = null;
      horizontalActive = false;
      deferToNativeScroll = false;
      velocityX = 0;
      velocitySamples = [];
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!enabledRef.current || !touchTracking) return;

      const touch = event.touches[0];
      if (!touch) return;

      const x = touch.clientX;
      const y = touch.clientY;
      const dx = x - startX;
      const dy = y - startY;
      trackVelocity(x);

      if (!lockedAxis) {
        if (
          Math.abs(dx) < MODULE_SWIPE_ACTIVATE_PX &&
          Math.abs(dy) < MODULE_SWIPE_ACTIVATE_PX
        ) {
          return;
        }

        if (shouldDeferToProfileSheetHorizontalScroll(event.target, dx)) {
          lockedAxis = "vertical";
          deferToNativeScroll = true;
          return;
        }

        if (Math.abs(dx) > Math.abs(dy) * MODULE_SWIPE_AXIS_RATIO) {
          lockedAxis = "horizontal";
          horizontalActive = true;
        } else {
          lockedAxis = "vertical";
          return;
        }
      }

      if (lockedAxis !== "horizontal" || deferToNativeScroll) return;

      horizontalActive = true;
      event.preventDefault();
      applyHorizontalOffset(dx);
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!touchTracking) return;
      const touch = event.changedTouches[0];
      if (!touch || !horizontalActive) {
        resetGesture();
        return;
      }

      finishHorizontalSwipe(touch.clientX - startX);
      resetGesture();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [containerRef, enabled, activeApp, panX]);
}
