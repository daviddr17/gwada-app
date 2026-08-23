"use client";

import { createContext } from "react";

export type SoftNavLockValue = {
  tryAcquireNavLock: (
    event: { preventDefault: () => void },
    targetHref: string,
  ) => boolean;
  /** Ziel-Route während Soft-Nav — Sidebar + Overlay. */
  pendingHref: string | null;
  /** Coalesced navigation — letzter Klick gewinnt. */
  scheduleSoftNavPush: (href: string) => void;
  /**
   * Pending Soft-Nav abbrechen (z. B. Chat öffnen in Nachrichten).
   * Verhindert, dass ein hängendes Modul-Pending (Reservierungen …)
   * Keep-alive-Sichtbarkeit / Titel stiehlt.
   */
  cancelSoftNavPending: () => void;
};

export const SoftNavLockContext = createContext<SoftNavLockValue | null>(null);

export function normalizeNavHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

/** Safe defaults when SoftNavLockProvider is below (Dashboard SPA layout tree). */
export const SOFT_NAV_LOCK_FALLBACK: SoftNavLockValue = {
  tryAcquireNavLock: () => true,
  pendingHref: null,
  scheduleSoftNavPush: () => {},
  cancelSoftNavPending: () => {},
};
