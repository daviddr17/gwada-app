import { crossAppModuleNavigation } from "@/lib/navigation/app-module-navigation";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { navigateDashboardHome } from "@/lib/navigation/navigate-dashboard-home";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import {
  beginSoftNavFlight,
  isSoftNavFlightActive,
} from "@/lib/navigation/soft-nav-flight-guard";
import { enqueueAppSoftNav } from "@/lib/navigation/soft-nav-queue";
import { appZoneFromPath } from "@/lib/navigation/workspace-zone-meta";

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

type AppRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
  refresh: () => void;
};

/**
 * App-Navigation: nur Zonenwechsel (App ↔ Superadmin) per Full-Load via /zone/enter;
 * Modul-Wechsel und Untermenü per Soft-Nav (Provider + Caches bleiben gemountet).
 */
export function navigateAppPath(
  router: AppRouter,
  fromPath: string,
  toPath: string,
): void {
  const target = safeInternalPath(toPath.trim() || "/dashboard");
  if (assignCrossAppWorkspaceZone(fromPath, target)) return;

  const crossModule = crossAppModuleNavigation(fromPath, target);
  if (!crossModule) {
    router.push(target);
    return;
  }

  if (
    isDashboardHomePath(target) &&
    !isDashboardHomePath(fromPath)
  ) {
    if (isSoftNavFlightActive()) return;
    enqueueAppSoftNav(async () => {
      if (!beginSoftNavFlight(target)) return;
      await navigateDashboardHome(router, target);
    });
    return;
  }

  if (!beginSoftNavFlight(target)) return;
  router.push(target);
}
