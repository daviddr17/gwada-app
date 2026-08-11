import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { shouldSkipBackgroundModulePrefetch } from "@/lib/navigation/soft-nav-flight";

/**
 * Full RSC + Page-Segment prefetch.
 * Default `router.prefetch` ist AUTO/PPR und stoppt an `loading.tsx` —
 * erster Modul-Klick bleibt dann kalt (mehrere Sekunden Skeleton).
 * Während Soft-Nav: keine fremden Background-Prefetches (Flight-Starvation).
 */
export function prefetchAppModuleHref(
  router: AppRouterInstance,
  href: string,
): void {
  if (shouldSkipBackgroundModulePrefetch(href)) return;
  router.prefetch(href, { kind: PrefetchKind.FULL });
}
