"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
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
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

const ROUTE_PREFETCH_STAGGER_MS = 25;

/**
 * Workspace ready → synchron Cache seed + sofort Priority-Routen/Daten,
 * bevor der Nutzer klicken kann (useLayoutEffect, nicht useEffect).
 */
export function AppModuleWarmPrefetchMount() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const warmedForRef = useRef<string | null>(null);

  useLayoutEffect(() => {
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
      router.prefetch(route);
    }

    prefetchCriticalModuleQueries(queryClient, restaurantId);
    prefetchAppModuleQueryCaches(queryClient, restaurantId);

    runWhenIdle(() => {
      warmAppModuleSecondaryCaches(queryClient, restaurantId);
    }, 400);

    runWhenIdle(() => {
      let index = 0;
      for (const route of APP_MODULE_PREFETCH_ROUTES) {
        if (APP_MODULE_PRIORITY_ROUTES.includes(route)) continue;
        window.setTimeout(() => {
          router.prefetch(route);
        }, index * ROUTE_PREFETCH_STAGGER_MS);
        index += 1;
      }
    }, 600);
  }, [queryClient, restaurantId, router, workspaceReady]);

  return null;
}
