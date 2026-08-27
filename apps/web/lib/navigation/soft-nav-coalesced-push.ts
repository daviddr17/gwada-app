"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Schnelle Soft-Nav-Klicks → nur das letzte Ziel wirklich `router.push`en.
 * Pending-UI bleibt synchron; der Flight wird nicht mit Dutzenden RSC-Requests zugeschüttet.
 *
 * - Erster Klick: `queueMicrotask` (früher als `setTimeout(0)`, trotzdem nicht sync
 *   Leading-Edge — der verkeilt Next/Router unter Stress)
 * - Weitere Klicks im Burst: trailing coalesce (32ms), letzter gewinnt
 */
const COALESCE_MS = 32;

let pendingHref: string | null = null;
let timer: number | null = null;
/** Marker: Microtask für den ersten Push steht aus (kein window-Timer). */
let firstPushMicrotaskPending = false;

export function coalesceSoftNavPush(
  router: AppRouterInstance,
  href: string,
): void {
  pendingHref = href;

  if (timer != null || firstPushMicrotaskPending) {
    if (timer != null) {
      window.clearTimeout(timer);
    }
    firstPushMicrotaskPending = false;
    timer = window.setTimeout(() => {
      timer = null;
      flushSoftNavPush(router);
    }, COALESCE_MS);
    return;
  }

  firstPushMicrotaskPending = true;
  queueMicrotask(() => {
    if (!firstPushMicrotaskPending) return;
    firstPushMicrotaskPending = false;
    // Zwischen Microtask-Schedule und Lauf schon ein Burst-Timer? Dann trailing.
    if (timer != null) return;
    flushSoftNavPush(router);
  });
}

/** Sofort pushen (Failsafe-Retry / letzter Stand). */
export function flushSoftNavPush(router: AppRouterInstance): string | null {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
  firstPushMicrotaskPending = false;
  const target = pendingHref;
  pendingHref = null;
  if (!target) return null;
  router.push(target);
  return target;
}

/** Pending-Push verwerfen ohne Navigation (Hard-Clear / Unmount). */
export function cancelSoftNavCoalescedPush(): void {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
  firstPushMicrotaskPending = false;
  pendingHref = null;
}

export function resetSoftNavCoalescedPushForTests(): void {
  cancelSoftNavCoalescedPush();
}
