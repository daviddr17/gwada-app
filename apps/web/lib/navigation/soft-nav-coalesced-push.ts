"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Schnelle Soft-Nav-Klicks → nur das letzte Ziel wirklich `router.push`en.
 * Erster Klick: sofort (leading). Weitere innerhalb des Fensters: trailing.
 */
const COALESCE_MS = 48;

let pendingHref: string | null = null;
let timer: number | null = null;
let lastPushedHref: string | null = null;
let coalesceOpen = false;

export function coalesceSoftNavPush(
  router: AppRouterInstance,
  href: string,
): void {
  pendingHref = href;
  if (!coalesceOpen) {
    coalesceOpen = true;
    flushSoftNavPush(router);
    timer = window.setTimeout(() => {
      timer = null;
      coalesceOpen = false;
      if (pendingHref) flushSoftNavPush(router);
    }, COALESCE_MS);
    return;
  }
  if (timer != null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    coalesceOpen = false;
    flushSoftNavPush(router);
  }, COALESCE_MS);
}

/** Sofort pushen (Failsafe-Retry / letzter Stand). */
export function flushSoftNavPush(router: AppRouterInstance): string | null {
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
  coalesceOpen = false;
}
