import { crossAppModuleNavigation } from "@/lib/navigation/app-module-navigation";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
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

/** Modul-Wechsel (Dashboard ↔ Kontakte ↔ Mitarbeiter …) per Full-Load — stabiler als Soft-RSC-Nav. */
export function assignCrossAppModuleNavigation(fromPath: string, toPath: string): boolean {
  const target = safeInternalPath(toPath.trim() || "/dashboard");
  if (typeof window === "undefined" || !crossAppModuleNavigation(fromPath, target)) {
    return false;
  }
  window.location.assign(target);
  return true;
}

type AppRouterPush = { push: (href: string) => void };

/**
 * App-Navigation: Zone- und Modul-Wechsel per Full-Load; Untermenü im Modul per Soft-Nav.
 */
export function navigateAppPath(
  router: AppRouterPush,
  fromPath: string,
  toPath: string,
): void {
  const target = safeInternalPath(toPath.trim() || "/dashboard");
  if (assignCrossAppWorkspaceZone(fromPath, target)) return;
  if (assignCrossAppModuleNavigation(fromPath, target)) return;
  router.push(target);
}
