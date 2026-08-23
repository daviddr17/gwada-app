"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Schnelle Soft-Nav-Klicks → nur das letzte Ziel wirklich `router.push`en.
 * Pending-UI bleibt synchron; der Flight wird nicht mit Dutzenden RSC-Requests zugeschüttet.
 *
 * - Erster Klick: `setTimeout(0)` (Next-16-sicher, ohne Leading-Edge-Doppel-Push)
 * - Weitere Klicks im Burst: trailing coalesce (32ms), letzter gewinnt
 *
 * Leading-Edge + sofortiger Push verkeilt den Router unter Stress; 32ms auf jeden
 * einzelnen Klick war spürbar langsam.
 */
const COALESCE_MS = 32;

let pendingHref: string | null = null;
let timer: number | null = null;

export function coalesceSoftNavPush(
  router: AppRouterInstance,
  href: string,
): void {
  pendingHref = href;
  if (timer != null) {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      flushSoftNavPush(router);
    }, COALESCE_MS);
    return;
  }
  timer = window.setTimeout(() => {
    timer = null;
    flushSoftNavPush(router);
  }, 0);
}

/** Sofort pushen (Failsafe-Retry / letzter Stand). */
export function flushSoftNavPush(router: AppRouterInstance): string | null {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
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
  pendingHref = null;
}

export function resetSoftNavCoalescedPushForTests(): void {
  cancelSoftNavCoalescedPush();
}
