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
import { isSoftNavFlightActive } from "@/lib/navigation/soft-nav-flight";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

/** Langsamer Stagger — weniger Main-Thread-/Netz-Druck während Dashboard-Stream. */
const ROUTE_PREFETCH_STAGGER_MS = 160;
/** FULL-Prefetch erst nach KPI (+ Pause), nicht sofort bei Workspace-Ready. */
const FULL_PREFETCH_AFTER_KPI_MS = 4_500;
const FULL_PREFETCH_FAILSAFE_MS = 10_000;
/** Priority-API nach KPI; Secondary deutlich später. */
const PRIORITY_DATA_AFTER_KPI_MS = 1_200;
const SECONDARY_DATA_AFTER_KPI_MS = 8_000;
const DASHBOARD_WARM_FAILSAFE_MS = 6_500;

/**
 * Background-Warm für Soft-Nav — absichtlich **nach** Dashboard-First-Paint.
 *
 * - Kein Massen-FULL beim ersten Workspace-Ready
 * - Modul-API erst nach KPI (Priority), Secondary idle/spät
 * - Soft-Nav darf den Warm nicht abbrechen (kein cancel bei Pathname-Wechsel)
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

  // FULL-Routes einmal pro Restaurant — gestaffelt, KPI-gated auf Dashboard.
  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId) ||
      routesWarmedForRef.current === restaurantId
    ) {
      return;
    }

    const timers: number[] = [];
    let started = false;

    const startRoutePrefetch = () => {
      if (started || routesWarmedForRef.current === restaurantId) return;
      started = true;
      routesWarmedForRef.current = restaurantId;

      const immediateFull = new Set<string>(APP_MODULE_IMMEDIATE_FULL_ROUTES);
      let fullIndex = 0;

      const scheduleFull = (route: string) => {
        const delay = fullIndex * ROUTE_PREFETCH_STAGGER_MS;
        fullIndex += 1;
        timers.push(
          window.setTimeout(() => {
            // Soft-Nav hat Vorrang — Prefetch später nachholen.
            if (isSoftNavFlightActive()) {
              timers.push(
                window.setTimeout(() => {
                  if (!isSoftNavFlightActive()) {
                    prefetchAppModuleHref(router, route);
                  }
                }, 800),
              );
              return;
            }
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

      const seen = new Set<string>([
        ...APP_MODULE_IMMEDIATE_FULL_ROUTES,
        ...APP_MODULE_PRIORITY_ROUTES,
      ]);
      let nestedIndex = 0;
      for (const route of APP_MODULE_PREFETCH_ROUTES) {
        if (seen.has(route)) continue;
        seen.add(route);
        const delay =
          fullIndex * ROUTE_PREFETCH_STAGGER_MS +
          nestedIndex * ROUTE_PREFETCH_STAGGER_MS;
        nestedIndex += 1;
        timers.push(
          window.setTimeout(() => {
            prefetchAppModuleHref(router, route);
          }, delay),
        );
      }
    };

    const onDashboard = isDashboardHomePath(pathnameRef.current);
    if (!onDashboard) {
      startRoutePrefetch();
      return () => {
        for (const id of timers) window.clearTimeout(id);
      };
    }

    const unsub = onDashboardFirstKpiReady(restaurantId, () => {
      timers.push(
        window.setTimeout(startRoutePrefetch, FULL_PREFETCH_AFTER_KPI_MS),
      );
    });
    const failsafe = window.setTimeout(
      startRoutePrefetch,
      FULL_PREFETCH_FAILSAFE_MS,
    );

    return () => {
      unsub();
      window.clearTimeout(failsafe);
      for (const id of timers) window.clearTimeout(id);
      if (routesWarmedForRef.current === restaurantId && !started) {
        routesWarmedForRef.current = null;
      }
    };
  }, [queryClient, restaurantId, router, workspaceReady]);

  // API-Daten einmal pro Restaurant — KPI-gated, Secondary spät.
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
    const timers: number[] = [];

    const startModuleWarm = () => {
      if (cancelled || warmStarted) return;
      warmStarted = true;

      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          prefetchCriticalModuleQueries(queryClient, restaurantId);
          runWhenIdle(() => {
            if (cancelled) return;
            prefetchAppModuleQueryCaches(queryClient, restaurantId);
            warmPriorityModuleDataCaches(queryClient, restaurantId);
          }, 80);
        }, PRIORITY_DATA_AFTER_KPI_MS),
      );

      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          runWhenIdle(() => {
            if (cancelled) return;
            warmAppModuleSecondaryCaches(queryClient, restaurantId);
          }, 200);
        }, SECONDARY_DATA_AFTER_KPI_MS),
      );
    };

    const onDashboard = isDashboardHomePath(pathnameRef.current);
    const hasCachedKpis = Boolean(
      peekDashboardBatchSummaryCache(restaurantId, []),
    );

    if (!onDashboard || hasCachedKpis) {
      if (hasCachedKpis && onDashboard) {
        runWhenIdle(startModuleWarm, 400);
      } else {
        startModuleWarm();
      }
      return () => {
        cancelled = true;
        for (const id of timers) window.clearTimeout(id);
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
      for (const id of timers) window.clearTimeout(id);
      if (dataWarmedForRef.current === restaurantId) {
        dataWarmedForRef.current = null;
      }
    };
  }, [queryClient, restaurantId, workspaceReady]);

  return null;
}
