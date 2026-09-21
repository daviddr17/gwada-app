"use client";

import { usePathname as useNextPathname } from "next/navigation";

/**
 * Next `usePathname()` kann während SSR/static kurz `null` sein.
 * Alle Call-Sites, die `.startsWith` / Zone-Checks brauchen, sollen diesen Hook nutzen.
 */
export function useSafePathname(fallback = "/"): string {
  return useNextPathname() ?? fallback;
}
