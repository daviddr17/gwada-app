import type { SidebarModuleDefinition } from "@/lib/constants/sidebar-modules";
import { isDashboardHomePath } from "@/lib/navigation/dashboard-home-path";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { normalizeNavHref } from "@/lib/navigation/soft-nav-lock-context";

function normalizedPendingHref(pendingHref: string | null): string | null {
  if (pendingHref == null) return null;
  return normalizeNavHref(pendingHref);
}

function isPendingDashboardHome(pendingHref: string | null): boolean {
  const pending = normalizedPendingHref(pendingHref);
  return pending != null && isDashboardHomePath(pending);
}

/**
 * Sidebar „Dashboard“ — exakt Home, nicht Modul-Prefixe.
 * Während Soft-Nav zurück zum Dashboard gewinnt dieser Eintrag gegen Module.
 */
export function isSidebarDashboardActive(
  pathname: string,
  pendingHref: string | null,
): boolean {
  const pending = normalizedPendingHref(pendingHref);

  if (pending != null && !isDashboardHomePath(pending)) {
    return false;
  }

  if (isDashboardHomePath(pathname)) return true;
  return isPendingDashboardHome(pendingHref);
}

export function isSidebarModuleActive(
  pathname: string,
  pendingHref: string | null,
  mod: Pick<SidebarModuleDefinition, "href" | "pathPrefix">,
): boolean {
  if (isSidebarDashboardActive(pathname, pendingHref)) return false;

  const path = normalizeNavHref(pathname);
  const pending = normalizedPendingHref(pendingHref);
  const modHref = normalizeNavHref(mod.href);
  const prefix = normalizeNavHref(mod.pathPrefix);

  if (pending != null && modHref === pending) return true;
  return path === prefix || path.startsWith(`${prefix}/`);
}
