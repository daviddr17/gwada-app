"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { prefetchAppModuleQueryCaches } from "@/lib/hooks/app-module-query-prefetch";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { APP_MODULE_PREFETCH_ROUTES } from "@/lib/navigation/app-module-route-prefetch";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

const WARM_START_DELAY_MS = 800;
const ROUTE_PREFETCH_STAGGER_MS = 120;

function runWhenIdle(task: () => void, timeoutMs = 4000): void {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => task(), { timeout: timeoutMs });
    return;
  }
  setTimeout(task, Math.min(timeoutMs, 1500));
}

/**
 * Nach initialem Dashboard-Load: Modul-Daten + RSC-Routen im Hintergrund wärmen,
 * damit Sidebar-Wechsel instant wirken (Cache + prefetched Flight).
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

    const startTimer = window.setTimeout(() => {
      runWhenIdle(() => {
        prefetchAppModuleQueryCaches(queryClient, restaurantId);
      });

      runWhenIdle(() => {
        APP_MODULE_PREFETCH_ROUTES.forEach((route, index) => {
          window.setTimeout(() => {
            router.prefetch(route);
          }, index * ROUTE_PREFETCH_STAGGER_MS);
        });
      }, 6000);
    }, WARM_START_DELAY_MS);

    return () => {
      window.clearTimeout(startTimer);
    };
  }, [queryClient, restaurantId, router, workspaceReady]);

  return null;
}
