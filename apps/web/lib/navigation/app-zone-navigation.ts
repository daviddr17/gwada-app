export type AppWorkspaceZone = "superadmin" | "app";

export function appZoneFromPath(pathname: string): AppWorkspaceZone {
  return pathname.startsWith("/superadmin") ? "superadmin" : "app";
}

/** Restaurant-App (Sidebar-Module, Dashboard, Einstellungen) — nicht Superadmin. */
export function isRestaurantAppZone(pathname: string): boolean {
  return appZoneFromPath(pathname) === "app";
}

export function isSuperadminZone(pathname: string): boolean {
  return appZoneFromPath(pathname) === "superadmin";
}

export function crossAppWorkspaceZone(fromPath: string, toPath: string): boolean {
  const target = toPath.trim() || "/dashboard";
  return appZoneFromPath(fromPath) !== appZoneFromPath(target);
}

type AppRouterPush = { push: (href: string) => void };

/**
 * Wechsel Superadmin ↔ App per Full-Load — vermeidet sporadische
 * Next.js-Soft-Nav-Fehler („This page couldn't load“).
 */
export function navigateAppPath(
  router: AppRouterPush,
  fromPath: string,
  toPath: string,
): void {
  const target = toPath.trim() || "/dashboard";
  if (typeof window !== "undefined" && crossAppWorkspaceZone(fromPath, target)) {
    window.location.assign(target);
    return;
  }
  router.push(target);
}
