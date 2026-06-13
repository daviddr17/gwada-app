import { crossAppModuleNavigation } from "@/lib/navigation/app-module-navigation";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import {
  beginSoftNavFlight,
  isSoftNavFlightActive,
} from "@/lib/navigation/soft-nav-flight-guard";
import { appZoneFromPath } from "@/lib/navigation/workspace-zone-meta";
import { startTransition } from "react";

export function crossAppWorkspaceZone(fromPath: string, toPath: string): boolean {
  const target = toPath.trim() || "/dashboard";
  return appZoneFromPath(fromPath) !== appZoneFromPath(target);
}

/** Sweep-Seite vor Full-Load zwischen Superadmin und App (wie /auth/enter). */
export function workspaceZoneEnterHref(next: string): string {
  const target = safeInternalPath(next);
  return `/zone/enter?next=${encodeURIComponent(target)}`;
}

export function assignCrossAppWorkspaceZone(fromPath: string, toPath: string): boolean {
  const target = safeInternalPath(toPath.trim() || "/dashboard");
  if (typeof window === "undefined" || !crossAppWorkspaceZone(fromPath, target)) {
    return false;
  }
  window.location.assign(workspaceZoneEnterHref(target));
  return true;
}

type AppRouterPush = { push: (href: string) => void };

/**
 * App-Navigation: nur Zonenwechsel (App ↔ Superadmin) per Full-Load via /zone/enter;
 * Modul-Wechsel und Untermenü per Soft-Nav (Provider + Caches bleiben gemountet).
 */
export function navigateAppPath(
  router: AppRouterPush,
  fromPath: string,
  toPath: string,
): void {
  const target = safeInternalPath(toPath.trim() || "/dashboard");
  if (assignCrossAppWorkspaceZone(fromPath, target)) return;
  if (
    crossAppModuleNavigation(fromPath, target) &&
    !beginSoftNavFlight(target)
  ) {
    return;
  }
  startTransition(() => {
    router.push(target);
  });
}
