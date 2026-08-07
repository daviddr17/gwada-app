"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { peekDashboardBatchSummaryCache } from "@/lib/dashboard/dashboard-batch-summary-cache";
import { onDashboardFirstKpiReady } from "@/lib/dashboard/dashboard-first-kpi-ready";
import {
  prefetchCriticalModuleQueries,
  seedPriorityModuleQueryCaches,
  warmPriorityModuleDataCaches,
} from "@/lib/hooks/app-module-intent-prefetch";
import { warmAppModuleSecondaryCaches } from "@/lib/hooks/app-module-warm-prefetch";
import { prefetchAppModuleQueryCaches } from "@/lib/hooks/app-module-query-prefetch";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { APP_MODULE_IMMEDIATE_FULL_ROUTES } from "@/lib/navigation/app-module-immediate-prefetch-routes";
import { APP_MODULE_PRIORITY_ROUTES } from "@/lib/navigation/app-module-priority-routes";
import { APP_MODULE_PREFETCH_ROUTES } from "@/lib/navigation/app-module-route-prefetch";
import { prefetchAppModuleHref } from "@/lib/navigation/prefetch-app-module-href";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

const ROUTE_PREFETCH_STAGGER_MS = 40;
/** Failsafe: falls Stream hängt, Daten-Warm trotzdem starten. */
const DASHBOARD_WARM_FAILSAFE_MS = 900;

/**
 * Workspace ready → Sidebar FULL gestaffelt (RSC vor erstem Tap).
 * Modul-API-Warm nach erstem Dashboard-KPI (oder sofort wenn Batch warm / nicht /dashboard).
 * Soft-Nav darf den Warm nicht abbrechen (kein cancel bei Pathname-Wechsel).
 */
export function AppModuleWarmPrefetchMount() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const routesWarmedForRef = useRef<string | null>(null);
  const dataWarmedForRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // FULL-Routes einmal pro Restaurant — überlebt Soft-Nav.
  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId) ||
      routesWarmedForRef.current === restaurantId
    ) {
      return;
    }
    routesWarmedForRef.current = restaurantId;

    const timers: number[] = [];
    const immediateFull = new Set<string>(APP_MODULE_IMMEDIATE_FULL_ROUTES);
    let fullIndex = 0;

    const scheduleFull = (route: string) => {
      const delay = fullIndex * ROUTE_PREFETCH_STAGGER_MS;
      fullIndex += 1;
      timers.push(
        window.setTimeout(() => {
          prefetchAppModuleHref(router, route);
        }, delay),
      );
    };

    for (const route of APP_MODULE_IMMEDIATE_FULL_ROUTES) {
      scheduleFull(route);
    }
    for (const route of APP_MODULE_PRIORITY_ROUTES) {
      if (immediateFull.has(route)) continue;
      scheduleFull(route);
    }

    // Nested / Settings-Routen nach Sidebar.
    const seen = new Set<string>([
      ...APP_MODULE_IMMEDIATE_FULL_ROUTES,
      ...APP_MODULE_PRIORITY_ROUTES,
    ]);
    let nestedIndex = 0;
    for (const route of APP_MODULE_PREFETCH_ROUTES) {
      if (seen.has(route)) continue;
      seen.add(route);
      const delay = fullIndex * ROUTE_PREFETCH_STAGGER_MS + nestedIndex * ROUTE_PREFETCH_STAGGER_MS;
      nestedIndex += 1;
      timers.push(
        window.setTimeout(() => {
          prefetchAppModuleHref(router, route);
        }, delay),
      );
    }

    return () => {
      for (const id of timers) window.clearTimeout(id);
      if (routesWarmedForRef.current === restaurantId) {
        routesWarmedForRef.current = null;
      }
    };
  }, [queryClient, restaurantId, router, workspaceReady]);

  // API-Daten einmal pro Restaurant — KPI-gated, Soft-Nav bricht nicht ab.
  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId) ||
      dataWarmedForRef.current === restaurantId
    ) {
      return;
    }
    dataWarmedForRef.current = restaurantId;

    seedPriorityModuleQueryCaches(queryClient, restaurantId);

    let cancelled = false;
    let warmStarted = false;

    const startModuleWarm = () => {
      if (cancelled || warmStarted) return;
      warmStarted = true;

      prefetchCriticalModuleQueries(queryClient, restaurantId);

      runWhenIdle(() => {
        if (cancelled) return;
        prefetchAppModuleQueryCaches(queryClient, restaurantId);
        warmPriorityModuleDataCaches(queryClient, restaurantId);
      }, 40);

      runWhenIdle(() => {
        if (cancelled) return;
        warmAppModuleSecondaryCaches(queryClient, restaurantId);
      }, 200);
    };

    const onDashboard = isDashboardHomePath(pathnameRef.current);
    const hasCachedKpis = Boolean(
      peekDashboardBatchSummaryCache(restaurantId, []),
    );

    if (!onDashboard || hasCachedKpis) {
      if (hasCachedKpis && onDashboard) {
        runWhenIdle(startModuleWarm, 120);
      } else {
        startModuleWarm();
      }
      return () => {
        cancelled = true;
        if (dataWarmedForRef.current === restaurantId) {
          dataWarmedForRef.current = null;
        }
      };
    }

    const unsub = onDashboardFirstKpiReady(restaurantId, startModuleWarm);
    const failsafe = window.setTimeout(
      startModuleWarm,
      DASHBOARD_WARM_FAILSAFE_MS,
    );

    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(failsafe);
      if (dataWarmedForRef.current === restaurantId) {
        dataWarmedForRef.current = null;
      }
    };
  }, [queryClient, restaurantId, workspaceReady]);

  return null;
}
