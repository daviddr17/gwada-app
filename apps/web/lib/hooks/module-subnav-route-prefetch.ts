"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { QueryClient } from "@tanstack/react-query";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { warmModuleRouteIntent } from "@/lib/hooks/app-module-intent-prefetch";
import { prefetchAppModuleHref } from "@/lib/navigation/prefetch-app-module-href";

const SUBNAV_PREFETCH_STAGGER_MS = 20;

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function isCurrentSubnavPath(pathname: string, item: ModuleSubnavItem): boolean {
  const path = normalizePath(pathname);
  const href = normalizePath(item.href);
  for (const extra of item.activeWhen ?? []) {
    if (path === normalizePath(extra)) return true;
  }
  const mode = item.matchMode ?? "prefix";
  if (mode === "exact") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

/** RSC-Flights + Modul-Daten für Chip-Untermenüs — gestaffelt, blockiert nicht. */
export function scheduleModuleSubnavRoutePrefetches(
  router: AppRouterInstance,
  queryClient: QueryClient | null,
  restaurantId: string | null,
  items: readonly ModuleSubnavItem[],
  pathname: string,
): number[] {
  const timeoutIds: number[] = [];
  let index = 0;

  for (const item of items) {
    if (item.disabled || isCurrentSubnavPath(pathname, item)) continue;

    const delay = index * SUBNAV_PREFETCH_STAGGER_MS;
    index += 1;

    const timeoutId = window.setTimeout(() => {
      if (queryClient && restaurantId) {
        warmModuleRouteIntent(router, queryClient, restaurantId, item.href);
        return;
      }
      prefetchAppModuleHref(router, item.href);
    }, delay);

    timeoutIds.push(timeoutId);
  }

  return timeoutIds;
}
