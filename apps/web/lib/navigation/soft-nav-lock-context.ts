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
};

export const SoftNavLockContext = createContext<SoftNavLockValue | null>(null);

export function normalizeNavHref(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}
