export { assignCrossAppWorkspaceZone } from "@/lib/navigation/workspace-zone-enter";

import { appZoneFromPath } from "@/lib/navigation/workspace-zone-meta";

/** Restaurant-App (Sidebar-Module, Dashboard, Einstellungen) — nicht Superadmin. */
export function isRestaurantAppZone(pathname: string): boolean {
  return appZoneFromPath(pathname) === "app";
}
