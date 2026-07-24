import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";

/**
 * Full RSC + Page-Segment prefetch.
 * Default `router.prefetch` ist AUTO/PPR und stoppt an `loading.tsx` —
 * erster Modul-Klick bleibt dann kalt (mehrere Sekunden Skeleton).
 */
export function prefetchAppModuleHref(
  router: AppRouterInstance,
  href: string,
): void {
  router.prefetch(href, { kind: PrefetchKind.FULL });
}
