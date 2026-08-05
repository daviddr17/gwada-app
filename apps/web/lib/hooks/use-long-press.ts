"use client";

import { useCallback, useEffect, useRef } from "react";

const DEFAULT_MS = 500;
const MOVE_CANCEL_PX = 24;

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, [role='button'], [data-no-long-press]",
    ),
  );
}

/**
 * Long-Press für Touch/Maus — bricht bei größerem Move oder interaktiven Kindern ab.
 * Rechtsklick (`onContextMenu`) als Desktop-Äquivalent.
 */
export function useLongPress(
  onLongPress: () => void,
  options?: { ms?: number; enableContextMenu?: boolean },
) {
  const ms = options?.ms ?? DEFAULT_MS;
  const enableContextMenu = options?.enableContextMenu ?? true;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );
  const firedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const onLongPressRef = useRef(onLongPress);
  onLongPressRef.current = onLongPress;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    startRef.current = null;
    firedRef.current = false;
  }, [clearTimer]);

  useEffect(() => () => reset(), [reset]);

  const fire = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    clearTimer();
    suppressClickRef.current = true;
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
    onLongPressRef.current();
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 450);
  }, [clearTimer]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (isInteractiveTarget(event.target)) return;
      reset();
      startRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      timerRef.current = setTimeout(fire, ms);
    },
    [fire, ms, reset],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      if (!timerRef.current && firedRef.current) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) {
        reset();
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [reset],
  );

  const onPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const start = startRef.current;
      if (start && start.pointerId === event.pointerId) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      }
      // Timer hat ggf. schon gefeuert — nur aufräumen.
      clearTimer();
      startRef.current = null;
      firedRef.current = false;
    },
    [clearTimer],
  );

  const onClickCapture = useCallback((event: React.MouseEvent) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!enableContextMenu) return;
      if (isInteractiveTarget(event.target)) return;
      event.preventDefault();
      onLongPressRef.current();
    },
    [enableContextMenu],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onClickCapture,
    onContextMenu,
  };
}
