"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  prefetchCriticalModuleQueries,
  seedPriorityModuleQueryCaches,
} from "@/lib/hooks/app-module-intent-prefetch";
import {
  warmAppModuleSecondaryCaches,
} from "@/lib/hooks/app-module-warm-prefetch";
import { prefetchAppModuleQueryCaches } from "@/lib/hooks/app-module-query-prefetch";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { APP_MODULE_PRIORITY_ROUTES } from "@/lib/navigation/app-module-priority-routes";
import { APP_MODULE_PREFETCH_ROUTES } from "@/lib/navigation/app-module-route-prefetch";
import { prefetchAppModuleHref } from "@/lib/navigation/prefetch-app-module-href";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

const ROUTE_PREFETCH_STAGGER_MS = 40;

/**
 * Workspace ready → Full-Route-Prefetch sofort, kritische Modul-Daten kurz danach.
 * AUTO-Prefetch stoppt an loading.tsx — FULL lädt das Page-Segment vor dem Klick.
 */
export function AppModuleWarmPrefetchMount() {
  const queryClient = useQueryClient();
  const router = useRouter();
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

    // Kritische Daten sofort anstoßen — nicht 800ms Idle hinter Dashboard-Batch warten.
    prefetchCriticalModuleQueries(queryClient, restaurantId);

    runWhenIdle(() => {
      prefetchAppModuleQueryCaches(queryClient, restaurantId);
    }, 200);

    runWhenIdle(() => {
      warmAppModuleSecondaryCaches(queryClient, restaurantId);
    }, 1_200);

    // Restliche Module früher FULL-prefetchen — Idle 1.5s ließ Erstbesuche kalt.
    runWhenIdle(() => {
      let index = 0;
      for (const route of APP_MODULE_PREFETCH_ROUTES) {
        if (APP_MODULE_PRIORITY_ROUTES.includes(route)) continue;
        window.setTimeout(() => {
          prefetchAppModuleHref(router, route);
        }, index * ROUTE_PREFETCH_STAGGER_MS);
        index += 1;
      }
    }, 400);
  }, [queryClient, restaurantId, router, workspaceReady]);

  return null;
}
