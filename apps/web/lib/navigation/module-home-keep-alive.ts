import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";

/** Module homes that stay warm under the App-Shell (hide, don't unmount). */
export type ModuleHomeId = "dashboard" | "reservierungen" | "nachrichten";

export const MODULE_HOME_PATHS: Record<ModuleHomeId, string> = {
  dashboard: APP_ROUTES.dashboard,
  reservierungen: APP_ROUTES.reservierungen.overview,
  nachrichten: APP_ROUTES.kontakte.messages,
};

export const MODULE_HOME_IDS = Object.keys(
  MODULE_HOME_PATHS,
) as ModuleHomeId[];

function normalizePath(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || APP_ROUTES.dashboard;
}

export function isModuleHomePath(
  pathname: string,
  id: ModuleHomeId,
): boolean {
  if (id === "dashboard") return isDashboardHomePath(pathname);
  return normalizePath(pathname) === MODULE_HOME_PATHS[id];
}

export function matchModuleHomeId(pathname: string): ModuleHomeId | null {
  const path = normalizePath(pathname);
  for (const id of MODULE_HOME_IDS) {
    if (isModuleHomePath(path, id)) return id;
  }
  return null;
}

export function isWarmModuleHomePending(
  pendingHref: string,
  warmIds: ReadonlySet<ModuleHomeId>,
): boolean {
  const id = matchModuleHomeId(pendingHref);
  return id != null && warmIds.has(id);
}

/**
 * Pflicht vor jedem router.push/replace in Keep-alive-Homes.
 * Warm + inactive bleibt gemountet — Navigation darf Soft-Nav nie zurückreißen.
 */
export function keepAliveMayNavigate(active: boolean): boolean {
  return active === true;
}

/**
 * URL-Mutation nur auf dem eigenen Modul-Home (zusätzlich zu `active`).
 * Verhindert z. B. `?unconfirmed=1` auf `/dashboard/menu` nach Soft-Nav + Drawer-Close.
 */
export function keepAliveOwnsPathname(
  active: boolean,
  pathname: string,
  id: ModuleHomeId,
): boolean {
  return keepAliveMayNavigate(active) && isModuleHomePath(pathname, id);
}
