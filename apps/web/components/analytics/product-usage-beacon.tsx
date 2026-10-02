"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { productUsageTarget } from "@/lib/analytics/classify-analytics-path";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

const recent = new Map<string, number>();

function shouldSend(key: string): boolean {
  const now = Date.now();
  const prev = recent.get(key) ?? 0;
  if (now - prev < 1200) return false;
  recent.set(key, now);
  return true;
}

/** Modulaufrufe der angemeldeten App, sobald das Workspace-Restaurant feststeht. */
export function ProductUsageBeacon() {
  const pathname = usePathname();
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();

  useEffect(() => {
    if (!pathname || !productUsageTarget(pathname)) return;
    if (!ready) return;
    const key = `module:${pathname}:${restaurantId ?? ""}`;
    if (!shouldSend(key)) return;
    void fetch("/api/analytics/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        kind: "module_view",
        path: pathname,
        restaurantId,
      }),
    }).catch(() => {});
  }, [pathname, ready, restaurantId]);

  return null;
}
