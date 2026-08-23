"use client";

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { QueryClient } from "@tanstack/react-query";
import { SIDEBAR_MODULE_DEFINITIONS } from "@/lib/constants/sidebar-modules";
import { warmModuleRouteIntent } from "@/lib/hooks/app-module-intent-prefetch";
import { isSoftNavFlightActive } from "@/lib/navigation/soft-nav-flight";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

const RECENT_SESSION_KEY = "gwada:recent-module-hrefs:v1";
const RECENT_MAX = 5;
const NEIGHBOR_RADIUS = 1;

function normalizePath(href: string): string {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/dashboard";
}

function sidebarIndexForHref(href: string): number {
  const path = normalizePath(href);
  if (path === "/dashboard") return -1;
  return SIDEBAR_MODULE_DEFINITIONS.findIndex(
    (m) => path === m.pathPrefix || path.startsWith(`${m.pathPrefix}/`),
  );
}

/** Nachbar-Module in der Sidebar (±1) — oft der nächste Klick. */
export function sidebarNeighborHrefs(currentHref: string): string[] {
  const idx = sidebarIndexForHref(currentHref);
  if (idx < 0) {
    // Vom Dashboard: erste Priority-Module (Speisekarte + Nachrichten).
    return [
      SIDEBAR_MODULE_DEFINITIONS[0]?.href,
      SIDEBAR_MODULE_DEFINITIONS.find((m) => m.id === "kontakte")?.href,
    ].filter((h): h is string => Boolean(h));
  }
  const out: string[] = [];
  for (let d = 1; d <= NEIGHBOR_RADIUS; d += 1) {
    const prev = SIDEBAR_MODULE_DEFINITIONS[idx - d];
    const next = SIDEBAR_MODULE_DEFINITIONS[idx + d];
    if (prev) out.push(prev.href);
    if (next) out.push(next.href);
  }
  return out;
}

export function readRecentModuleHrefs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(RECENT_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((h): h is string => typeof h === "string").slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** Soft-Nav angekommen — Modul für „wieder besucht“ merken. */
export function recordRecentModuleHref(href: string): void {
  if (typeof window === "undefined") return;
  const path = normalizePath(href);
  if (!path.startsWith("/dashboard")) return;
  // Nur Modul-Homes / Sidebar-Ziele — keine tiefen Settings-URLs aufblasen.
  const mod = SIDEBAR_MODULE_DEFINITIONS.find(
    (m) => path === m.pathPrefix || path.startsWith(`${m.pathPrefix}/`),
  );
  const homeHref = mod?.href ?? (path === "/dashboard" ? "/dashboard" : null);
  if (!homeHref) return;

  const prev = readRecentModuleHrefs().filter(
    (h) => normalizePath(h) !== normalizePath(homeHref),
  );
  const next = [homeHref, ...prev].slice(0, RECENT_MAX);
  try {
    sessionStorage.setItem(RECENT_SESSION_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

/**
 * Nach Settle / Idle: Nachbarn + kürzlich besuchte Module wärmen
 * (Chunks + Daten) — Facebook-ähnliche Predictive Prefetch.
 */
export function warmLikelyNextModules(
  router: AppRouterInstance,
  queryClient: QueryClient,
  restaurantId: string | null | undefined,
  currentHref: string,
): void {
  if (isSoftNavFlightActive()) {
    return;
  }
  if (restaurantId && !isUuidRestaurantId(restaurantId)) return;

  const current = normalizePath(currentHref);
  const candidates = [
    ...sidebarNeighborHrefs(currentHref),
    ...readRecentModuleHrefs(),
  ];
  const seen = new Set<string>();
  let delay = 0;
  for (const href of candidates) {
    const key = normalizePath(href);
    if (!key || key === current || seen.has(key)) continue;
    seen.add(key);
    const target = href;
    window.setTimeout(() => {
      if (isSoftNavFlightActive()) {
        return;
      }
      warmModuleRouteIntent(router, queryClient, restaurantId, target);
    }, delay);
    delay += 60;
  }
}

/** Idle-Wrapper für Mount nach Pathname-Settle. */
export function scheduleWarmLikelyNextModules(
  router: AppRouterInstance,
  queryClient: QueryClient,
  restaurantId: string | null | undefined,
  currentHref: string,
): () => void {
  recordRecentModuleHref(currentHref);
  let cancelled = false;
  let idleId: number | null = null;
  let timeoutId: number | null = null;

  const run = () => {
    if (cancelled) return;
    warmLikelyNextModules(router, queryClient, restaurantId, currentHref);
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    idleId = window.requestIdleCallback(run, { timeout: 1_500 });
  } else {
    timeoutId = window.setTimeout(run, 120);
  }

  return () => {
    cancelled = true;
    if (idleId != null && typeof window !== "undefined") {
      window.cancelIdleCallback?.(idleId);
    }
    if (timeoutId != null) window.clearTimeout(timeoutId);
  };
}
