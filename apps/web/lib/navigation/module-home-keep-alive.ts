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
 * Nach erstem KPI — häufigste Homes, gestaffelt.
 * Rest idle/später oder per Sidebar-Intent (kein Dashboard-Spike).
 */
export const MODULE_HOME_PRIORITY_PREWARM_IDS: readonly ModuleHomeId[] = [
  "menu",
  "inventory",
  "reservierungen",
  "nachrichten",
  "mitarbeiter",
];

/** Idle nach Priority — alle übrigen Sidebar-Homes. */
export const MODULE_HOME_SECONDARY_PREWARM_IDS: readonly ModuleHomeId[] = [
  "pos",
  "events",
  "news",
  "bewertungen",
  "insights",
  "galerie",
  "buchfuehrung",
  "dokumente",
  "checklisten",
];

/** @deprecated Prefer PRIORITY + SECONDARY. */
export const MODULE_HOME_PREWARM_IDS: readonly ModuleHomeId[] = [
  ...MODULE_HOME_PRIORITY_PREWARM_IDS,
  ...MODULE_HOME_SECONDARY_PREWARM_IDS,
];

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
  // Sidebar Events: /dashboard/events → Redirect-Home
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
