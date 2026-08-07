import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";

/** Module homes that stay warm under the App-Shell (hide, don't unmount). */
export type ModuleHomeId =
  | "dashboard"
  | "menu"
  | "inventory"
  | "reservierungen"
  | "pos"
  | "events"
  | "nachrichten"
  | "news"
  | "bewertungen"
  | "insights"
  | "galerie"
  | "buchfuehrung"
  | "dokumente"
  | "checklisten"
  | "mitarbeiter";

export const MODULE_HOME_PATHS: Record<ModuleHomeId, string> = {
  dashboard: APP_ROUTES.dashboard,
  menu: APP_ROUTES.menu.overview,
  inventory: APP_ROUTES.inventory.overview,
  reservierungen: APP_ROUTES.reservierungen.overview,
  pos: APP_ROUTES.pos.overview,
  events: APP_ROUTES.events.overview,
  nachrichten: APP_ROUTES.kontakte.messages,
  news: APP_ROUTES.news.overview,
  bewertungen: APP_ROUTES.bewertungen.overview,
  insights: APP_ROUTES.insights.overview,
  galerie: APP_ROUTES.galerie.overview,
  buchfuehrung: APP_ROUTES.buchfuehrung.invoices,
  dokumente: APP_ROUTES.dokumente.overview,
  checklisten: APP_ROUTES.checklisten.root,
  mitarbeiter: APP_ROUTES.mitarbeiter.overview,
};

/**
 * Leichtes Idle-Prewarm auf Dashboard (nur wenn Nutzer bleibt).
 * Kein Massen-Mount — sonst laggt Dashboard + Soft-Nav.
 */
export const MODULE_HOME_IDLE_PREWARM_IDS: readonly ModuleHomeId[] = [
  "menu",
  "reservierungen",
  "inventory",
];

/** Max. zusätzliche warme Homes neben Dashboard + aktuellem Home (LRU). */
export const MODULE_HOME_MAX_EXTRA_WARM = 4;

/** @deprecated */
export const MODULE_HOME_PRIORITY_PREWARM_IDS = MODULE_HOME_IDLE_PREWARM_IDS;
/** @deprecated — Secondary nur noch per Intent. */
export const MODULE_HOME_SECONDARY_PREWARM_IDS: readonly ModuleHomeId[] = [];
/** @deprecated */
export const MODULE_HOME_PREWARM_IDS = MODULE_HOME_IDLE_PREWARM_IDS;

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
  const path = normalizePath(pathname);
  if (path === MODULE_HOME_PATHS[id]) return true;
  if (id === "events" && path === APP_ROUTES.events.root) return true;
  return false;
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

export function keepAliveMayNavigate(active: boolean): boolean {
  return active === true;
}

export function keepAliveOwnsPathname(
  active: boolean,
  pathname: string,
  id: ModuleHomeId,
): boolean {
  return keepAliveMayNavigate(active) && isModuleHomePath(pathname, id);
}
