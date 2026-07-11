"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  warmAppModuleCaches,
  warmAppModulePriorityCaches,
} from "@/lib/hooks/app-module-warm-prefetch";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { APP_MODULE_PRIORITY_ROUTES } from "@/lib/navigation/app-module-priority-routes";
import { APP_MODULE_PREFETCH_ROUTES } from "@/lib/navigation/app-module-route-prefetch";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { runWhenIdle } from "@/lib/ui/run-when-idle";

const ROUTE_PREFETCH_STAGGER_MS = 40;

/**
 * Workspace ready → sofort Priority-Routen + Daten-Caches wärmen,
 * danach restliche Routen im Idle (SPA-artig: Klick trifft warmen Flight + Cache).
 */
export function AppModuleWarmPrefetchMount() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const startedRef = useRef(false);

  useEffect(() => {
    if (
      startedRef.current ||
      !workspaceReady ||
      !restaurantId ||
      !isUuidRestaurantId(restaurantId)
    ) {
      return;
    }
    startedRef.current = true;

    for (const route of APP_MODULE_PRIORITY_ROUTES) {
      router.prefetch(route);
    }

    warmAppModulePriorityCaches(queryClient, restaurantId);

    runWhenIdle(() => {
      warmAppModuleCaches(queryClient, restaurantId);
    }, 800);

    runWhenIdle(() => {
      let index = 0;
      for (const route of APP_MODULE_PREFETCH_ROUTES) {
        if (APP_MODULE_PRIORITY_ROUTES.includes(route)) continue;
        window.setTimeout(() => {
          router.prefetch(route);
        }, index * ROUTE_PREFETCH_STAGGER_MS);
        index += 1;
      }
    }, 1500);
  }, [queryClient, restaurantId, router, workspaceReady]);

  return null;
}
