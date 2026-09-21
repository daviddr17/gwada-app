"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { scheduleWarmLikelyNextModules } from "@/lib/navigation/app-module-predictive-prefetch";
import { isSoftNavFlightActive } from "@/lib/navigation/soft-nav-flight";

/**
 * Nach Soft-Nav-Settle: Sidebar-Nachbarn + kürzlich besuchte Module
 * im Idle vorwärmen (JS + Daten) — ohne Soft-Nav-Flight zu stören.
 */
export function AppModulePredictivePrefetchMount() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();

  useEffect(() => {
    if (!ready || !pathname?.startsWith("/dashboard")) return;
    if (isSoftNavFlightActive()) return;

    let cancelIdle: (() => void) | undefined;
    const settle = window.setTimeout(() => {
      if (isSoftNavFlightActive()) return;
      cancelIdle = scheduleWarmLikelyNextModules(
        router,
        queryClient,
        restaurantId,
        pathname,
      );
    }, 180);

    return () => {
      window.clearTimeout(settle);
      cancelIdle?.();
    };
  }, [pathname, queryClient, ready, restaurantId, router]);

  return null;
}
