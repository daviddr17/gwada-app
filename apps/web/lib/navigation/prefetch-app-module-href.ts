import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { prefetchDashboardSpaHref } from "@gwada/dashboard";
import { prefetchSuperadminSpaHref } from "@gwada/superadmin";
import { isZoneSpaHref } from "@/lib/navigation/spa-zone-path";
import { shouldSkipBackgroundModulePrefetch } from "@/lib/navigation/soft-nav-flight";

/**
 * Dashboard/Superadmin SPA: TanStack Route-Chunk preload.
 * Legacy Next-Zone: Full RSC + Page-Segment prefetch.
 */
export function prefetchAppModuleHref(
  router: AppRouterInstance,
  href: string,
): void {
  if (shouldSkipBackgroundModulePrefetch(href)) return;
  if (isZoneSpaHref("/dashboard", href)) {
    prefetchDashboardSpaHref(href);
    return;
  }
  if (isZoneSpaHref("/superadmin", href)) {
    prefetchSuperadminSpaHref(href);
    return;
  }
  router.prefetch(href, { kind: PrefetchKind.FULL });
}
