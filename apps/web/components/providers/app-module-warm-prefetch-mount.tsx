"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  prefetchCriticalModuleQueries,
  seedPriorityModuleQueryCaches,
  warmPriorityModuleDataCaches,
} from "@/lib/hooks/app-module-intent-prefetch";
import {
  warmAppModuleSecondaryCaches,
} from "@/lib/hooks/app-module-warm-prefetch";
import { prefetchAppModuleQueryCaches } from "@/lib/hooks/app-module-query-prefetch";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { APP_MODULE_PRIORITY_ROUTES } from "@/lib/navigation/app-module-priority-routes";
import { APP_MODULE_PREFETCH_ROUTES } from "@/lib/navigation/app-module-route-prefetch";
import { prefetchAppModuleHref } from "@/lib/navigation/prefetch-app-module-href";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

const ROUTE_PREFETCH_STAGGER_MS = 40;
/** Auf Dashboard-Home: Batch zuerst — Staff/Reservierungen-Warm nicht parallel kämpfen lassen. */
const CRITICAL_WARM_AFTER_DASHBOARD_BATCH_MS = 2_800;

/**
 * Workspace ready → Full-Route-Prefetch sofort, kritische Modul-Daten kurz danach.
 * AUTO-Prefetch stoppt an loading.tsx — FULL lädt das Page-Segment vor dem Klick.
 * Mobile: Priority-Modul-Daten ohne Hover vorwärmen.
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

    for (const route of APP_MODULE_PRIORITY_ROUTES) {
      prefetchAppModuleHref(router, route);
    }

    const deferCriticalForDashboard = isDashboardHomePath(pathname);
    if (deferCriticalForDashboard) {
      // Cold-Start auf /dashboard: Batch (Heute-KPIs) hat Vorrang vor Modul-Warm.
      runWhenIdle(() => {
        prefetchCriticalModuleQueries(queryClient, restaurantId);
      }, CRITICAL_WARM_AFTER_DASHBOARD_BATCH_MS);
    } else {
      prefetchCriticalModuleQueries(queryClient, restaurantId);
    }

    // Speisekarte/Bestand/… — Daten vor dem ersten Tap (kein Hover auf Touch).
    runWhenIdle(() => {
      prefetchAppModuleQueryCaches(queryClient, restaurantId);
      warmPriorityModuleDataCaches(queryClient, restaurantId);
    }, deferCriticalForDashboard ? 1_200 : 150);

    runWhenIdle(() => {
      warmAppModuleSecondaryCaches(queryClient, restaurantId);
    }, deferCriticalForDashboard ? 2_000 : 900);

    // Restliche Module FULL-prefetchen.
    runWhenIdle(() => {
      let index = 0;
      for (const route of APP_MODULE_PREFETCH_ROUTES) {
        if (APP_MODULE_PRIORITY_ROUTES.includes(route)) continue;
        window.setTimeout(() => {
          prefetchAppModuleHref(router, route);
        }, index * ROUTE_PREFETCH_STAGGER_MS);
        index += 1;
      }
    }, deferCriticalForDashboard ? 900 : 400);
  }, [queryClient, pathname, restaurantId, router, workspaceReady]);

  return null;
}
