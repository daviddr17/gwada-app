import { safeInternalPath } from "@/lib/navigation/safe-internal-path";
import { appZoneFromPath } from "@/lib/navigation/workspace-zone-meta";

function normalizePath(p: string): string {
  if (p.length > 1 && p.endsWith("/")) return p.slice(0, -1);
  return p;
}

function pathWithoutQuery(href: string): string {
  const q = href.indexOf("?");
  return q === -1 ? href : href.slice(0, q);
}

/**
 * Modul-Wurzel für App-Navigation, z. B. `/dashboard/kontakte` oder `/dashboard`.
 */
export function appModuleRootFromPath(pathname: string): string {
  const path = normalizePath(pathWithoutQuery(pathname));

  if (path === "/dashboard") return "/dashboard";

  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "dashboard" && parts.length >= 2) {
    return `/dashboard/${parts[1]}`;
  }

  if (parts[0] === "dashboard") return "/dashboard";

  const top = parts[0];
  if (top === "settings" || top === "profile" || top === "changelog") {
    return `/${top}`;
  }

  return path || "/dashboard";
}

/** Wechsel zwischen Dashboard-Home, Modulen oder Top-Level-App-Bereichen. */
export function crossAppModuleNavigation(fromPath: string, toPath: string): boolean {
  const target = safeInternalPath(toPath.trim() || "/dashboard");
  if (appZoneFromPath(fromPath) !== "app" || appZoneFromPath(target) !== "app") {
    return false;
  }
  return appModuleRootFromPath(fromPath) !== appModuleRootFromPath(target);
}

/** Full-Load statt Soft-Nav (vermeidet Next.js „This page couldn't load“). */
export function assignCrossAppModuleNavigation(
  fromPath: string,
  toPath: string,
): boolean {
  const target = safeInternalPath(toPath.trim() || "/dashboard");
  if (typeof window === "undefined" || !crossAppModuleNavigation(fromPath, target)) {
    return false;
  }
  window.location.assign(target);
  return true;
}

export function interceptAppNavigationClick(
  fromPath: string,
  toHref: string,
  event: { preventDefault(): void },
): boolean {
  const href = typeof toHref === "string" ? toHref : String(toHref);
  if (assignCrossAppModuleNavigation(fromPath, href)) {
    event.preventDefault();
    return true;
  }
  return false;
}
