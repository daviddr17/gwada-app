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
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

const ROUTE_PREFETCH_STAGGER_MS = 40;

/**
 * Workspace ready → Cache seed leicht, schwere Prefetches erst im Idle,
 * damit der erste Klick nicht gegen useLayoutEffect/Netzwerk-Sturm konkurriert.
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

    runWhenIdle(() => {
      for (const route of APP_MODULE_PRIORITY_ROUTES) {
        router.prefetch(route);
      }
      prefetchCriticalModuleQueries(queryClient, restaurantId);
      prefetchAppModuleQueryCaches(queryClient, restaurantId);
    }, 800);

    runWhenIdle(() => {
      warmAppModuleSecondaryCaches(queryClient, restaurantId);
    }, 1_500);

    runWhenIdle(() => {
      let index = 0;
      for (const route of APP_MODULE_PREFETCH_ROUTES) {
        if (APP_MODULE_PRIORITY_ROUTES.includes(route)) continue;
        window.setTimeout(() => {
          router.prefetch(route);
        }, index * ROUTE_PREFETCH_STAGGER_MS);
        index += 1;
      }
    }, 2_000);
  }, [queryClient, restaurantId, router, workspaceReady]);

  return null;
}
