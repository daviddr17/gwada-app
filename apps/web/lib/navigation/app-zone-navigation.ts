export {
  appZoneFromPath,
  type AppWorkspaceZone,
} from "@/lib/navigation/workspace-zone-meta";

export {
  assignCrossAppWorkspaceZone,
  crossAppWorkspaceZone,
  navigateAppPath,
  workspaceZoneEnterHref,
} from "@/lib/navigation/workspace-zone-enter";

export {
  appModuleRootFromPath,
  crossAppModuleNavigation,
} from "@/lib/navigation/app-module-navigation";

import { appZoneFromPath } from "@/lib/navigation/workspace-zone-meta";

/** Restaurant-App (Sidebar-Module, Dashboard, Einstellungen) — nicht Superadmin. */
export function isRestaurantAppZone(pathname: string): boolean {
  return appZoneFromPath(pathname) === "app";
}

export function isSuperadminZone(pathname: string): boolean {
  return appZoneFromPath(pathname) === "superadmin";
}
