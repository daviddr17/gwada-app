"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Schnelle Soft-Nav-Klicks → nur das letzte Ziel wirklich `router.push`en.
 * Pending-UI bleibt synchron; der Flight wird nicht mit Dutzenden RSC-Requests zugeschüttet.
 */
const COALESCE_MS = 32;

let pendingHref: string | null = null;
let timer: number | null = null;
let lastPushedHref: string | null = null;

export function coalesceSoftNavPush(
  router: AppRouterInstance,
  href: string,
): void {
  pendingHref = href;
  if (timer != null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    flushSoftNavPush(router);
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
  lastPushedHref = target;
  router.push(target);
  return target;
}

export function peekSoftNavCoalescedHref(): string | null {
  return pendingHref;
}

export function resetSoftNavCoalescedPushForTests(): void {
  if (timer != null) window.clearTimeout(timer);
  timer = null;
  pendingHref = null;
  lastPushedHref = null;
}
