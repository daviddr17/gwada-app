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

export const MODULE_HOME_IDS = Object.keys(
  MODULE_HOME_PATHS,
) as ModuleHomeId[];

function normalizePath(pathname: string): string {
  const path = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || APP_ROUTES.dashboard;
}

/** `/dashboard/menu` ≡ Übersicht, `/dashboard/kontakte` ≡ Nachrichten, … */
export function moduleHomeRootAlias(homePath: string): string | null {
  const parts = normalizePath(homePath).split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || parts.length < 3) return null;
  return `/${parts[0]}/${parts[1]}`;
}

export function isModuleHomePath(
  pathname: string,
  id: ModuleHomeId,
): boolean {
  if (id === "dashboard") return isDashboardHomePath(pathname);
  const path = normalizePath(pathname);
  const homePath = normalizePath(MODULE_HOME_PATHS[id]);
  if (path === homePath) return true;
  const alias = moduleHomeRootAlias(homePath);
  return alias != null && path === alias;
}

export function matchModuleHomeId(
  pathname: string | null | undefined,
): ModuleHomeId | null {
  if (!pathname) return null;
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
 * Soft-Nav-Ziel erreicht — inkl. Home-Aliase
 * (`/dashboard/menu` Redirect → `/dashboard/menu/uebersicht`).
 * Unterrouten (Einstellungen, Statistiken, …) nur bei exaktem Pfad.
 */
export function isSoftNavPendingArrived(
  pathname: string,
  pendingTarget: string,
): boolean {
  const path = normalizePath(pathname);
  const dest = normalizePath(pendingTarget);
  if (path === dest) return true;
  const pathHome = matchModuleHomeId(path);
  const destHome = matchModuleHomeId(dest);
  return pathHome != null && pathHome === destHome;
}

/**
 * Pathname hat die Quelle verlassen, ohne am Pending-Ziel (inkl. Home-Alias)
 * anzukommen — nur bei Unterrouten (Einstellungen, Statistiken, …).
 *
 * Nicht aufgeben, wenn ein älterer RSC auf einem *anderen Modul-Home*
 * ankommt (Speisekarte-Flight, während Events schon pending ist).
 */
export function shouldAbandonSoftNavPending(
  pathname: string,
  pendingFrom: string | null,
  pendingTarget: string | null,
): boolean {
  if (pendingFrom == null || pendingTarget == null) return false;
  if (isSoftNavPendingArrived(pathname, pendingTarget)) return false;
  const path = normalizePath(pathname);
  if (path === normalizePath(pendingFrom)) return false;
  if (matchModuleHomeId(path) != null) return false;
  return true;
}

/**
 * Soft-Nav erneut pushen: Push wurde geschluckt (noch Quelle) oder ein
 * älterer RSC hat ein anderes Modul-Home eingesetzt.
 * Nicht bei Unterrouten (Einstellungen) — dort gibt Pending auf.
 */
export function shouldRepushSoftNav(
  pathname: string,
  pendingFrom: string | null,
  pendingTarget: string | null,
): boolean {
  if (pendingFrom == null || pendingTarget == null) return false;
  if (isSoftNavPendingArrived(pathname, pendingTarget)) return false;
  if (shouldAbandonSoftNavPending(pathname, pendingFrom, pendingTarget)) {
    return false;
  }
  return true;
}

export type ModuleHomeSlotVisibility = {
  warm: boolean;
  visible: boolean;
  active: boolean;
};

/**
 * Welches Keep-alive-Home den Scroll-Bereich füllt.
 * Quelle während eines Flights zu einem anderen Home nie sichtbar halten —
 * sonst bleibt der alte Inhalt unter der neuen Überschrift.
 */
export function moduleHomeSlotVisibility({
  id,
  activeHomeId,
  pendingHomeId,
  pendingInFlight,
  warmFlag,
  suppressHomeId = null,
}: {
  id: ModuleHomeId;
  activeHomeId: ModuleHomeId | null;
  pendingHomeId: ModuleHomeId | null;
  pendingInFlight: boolean;
  warmFlag: boolean;
  /** Quelle nach Ankunft noch kurz unterdrücken — späte RSC-Reverts ohne Dashboard-Flash. */
  suppressHomeId?: ModuleHomeId | null;
}): ModuleHomeSlotVisibility {
  const onHome = activeHomeId === id;
  const warm = warmFlag || onHome;
  const pendingToThis = warm && pendingHomeId === id && !onHome;
  const showAsSource =
    onHome && !pendingInFlight && suppressHomeId !== id;
  const arrivedPending = onHome && pendingInFlight && pendingHomeId === id;
  return {
    warm,
    visible: showAsSource || pendingToThis || arrivedPending,
    active: showAsSource,
  };
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
