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
 * Workspace ready → alle Sidebar-Routes FULL sofort (RSC vor erstem Tap).
 * Modul-API-Warm nach erstem Dashboard-KPI (oder sofort wenn Batch warm / nicht /dashboard),
 * damit der Stream nicht gegen Staff/Menu/Inbox kämpft.
 */
export function AppModuleWarmPrefetchMount() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const warmedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId) ||
      warmedForRef.current === restaurantId
    ) {
      return;
    }
    warmedForRef.current = restaurantId;

    seedPriorityModuleQueryCaches(queryClient, restaurantId);

    // FULL-RSC konkurriert kaum mit Batch-API — sofort alle Priority-Module.
    // Top-5 zuerst (gleiche Tick-Reihenfolge), dann restliche Sidebar.
    const immediateFull = new Set<string>(APP_MODULE_IMMEDIATE_FULL_ROUTES);
    for (const route of APP_MODULE_IMMEDIATE_FULL_ROUTES) {
      prefetchAppModuleHref(router, route);
    }
    for (const route of APP_MODULE_PRIORITY_ROUTES) {
      if (immediateFull.has(route)) continue;
      prefetchAppModuleHref(router, route);
    }

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
      }, 350);

      runWhenIdle(() => {
        if (cancelled) return;
        const seen = new Set<string>([
          ...APP_MODULE_IMMEDIATE_FULL_ROUTES,
          ...APP_MODULE_PRIORITY_ROUTES,
        ]);
        let index = 0;
        for (const route of APP_MODULE_PREFETCH_ROUTES) {
          if (seen.has(route)) continue;
          seen.add(route);
          window.setTimeout(() => {
            if (cancelled) return;
            prefetchAppModuleHref(router, route);
          }, index * ROUTE_PREFETCH_STAGGER_MS);
          index += 1;
        }
      }, 120);
    };

    const onDashboard = isDashboardHomePath(pathname);
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
      };
    }

    // Dashboard Cold-Start: erstes Stream-KPI → dann warm (Batch behält Head-Start).
    const unsub = onDashboardFirstKpiReady(restaurantId, startModuleWarm);
    const failsafe = window.setTimeout(
      startModuleWarm,
      DASHBOARD_WARM_FAILSAFE_MS,
    );

    return () => {
      cancelled = true;
      unsub();
      window.clearTimeout(failsafe);
    };
  }, [queryClient, pathname, restaurantId, router, workspaceReady]);

  return null;
}
