"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Schnelle Soft-Nav-Klicks → nur das letzte Ziel wirklich `router.push`en.
 * Pending-UI bleibt synchron; der Flight wird nicht mit Dutzenden RSC-Requests zugeschüttet.
 *
 * Leading: erster Klick nach Idle pusht sofort (kein künstliches Lag).
 * Trailing: weitere Klicks im 120ms-Fenster coalescen — letzter gewinnt, weniger RSC/431.
 *
 * Next 16: `router.push` nicht synchron im Click (Stream kann ihn schlucken).
 * `setTimeout(0)` löst den Push aus dem Event; Pending bleibt synchron.
 * `startTransition` nicht — laufende Dashboard-Fetches können die Transition aushungern.
 */
const COALESCE_MS = 120;

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
  flushSoftNavPush(router);
  timer = window.setTimeout(() => {
    timer = null;
    if (pendingHref) flushSoftNavPush(router);
  }, COALESCE_MS);
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
  window.setTimeout(() => {
    router.push(target);
  }, 0);
  return target;
}
