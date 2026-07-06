import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";
import type { DashboardShortcutId } from "@/lib/constants/dashboard-shortcuts";
import {
  hasModuleRead,
  type ModuleCrudPrefix,
} from "@/lib/permissions/module-crud-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

const DASHBOARD_WIDGET_MODULE_PREFIX: Partial<
  Record<DashboardWidgetId, ModuleCrudPrefix>
> = {
  menu: "menu",
  reservations: "reservations",
  reviews: "reviews",
  staff: "staff",
  contacts: "contacts",
  messages: "contacts",
  inventory: "inventory",
};

const INTEGRATION_WIDGET_KEYS: RestaurantPermissionKey[] = [
  "integrations.whatsapp",
  "integrations.email",
  "integrations.facebook",
  "integrations.instagram",
  "integrations.google_business",
  "integrations.lexoffice",
  "settings.restaurant",
];

const DASHBOARD_SHORTCUT_MODULE_PREFIX: Record<
  DashboardShortcutId,
  ModuleCrudPrefix
> = {
  reservation: "reservations",
  menu_dish: "menu",
  inventory_ingredient: "inventory",
  contact: "contacts",
  document: "documents",
  staff_member: "staff",
  staff_shift: "staff",
  staff_work_entry: "staff",
  shift_template: "staff",
  review_invite: "reviews",
};

export type DashboardWidgetAccessOptions = {
  permissionsLoading?: boolean;
  weatherAvailable?: boolean;
  weatherLoading?: boolean;
};

/** Modul-Lese-Rechte wie Sidebar; Wetter nur bei Superadmin-Freigabe + API-Key. */
export function hasDashboardWidgetAccess(
  has: (key: RestaurantPermissionKey) => boolean,
  widgetId: DashboardWidgetId,
  options?: DashboardWidgetAccessOptions,
): boolean {
  if (widgetId === "weather") {
    if (options?.weatherLoading) return false;
    return options?.weatherAvailable === true;
  }
  if (widgetId === "heute") {
    if (options?.permissionsLoading) return true;
    return (
      hasModuleRead(has, "reservations") ||
      hasModuleRead(has, "staff") ||
      hasModuleRead(has, "contacts") ||
      hasModuleRead(has, "inventory") ||
      hasModuleRead(has, "reviews") ||
      options?.weatherAvailable === true
    );
  }
  if (options?.permissionsLoading) return true;
  if (widgetId === "integrations") {
    return INTEGRATION_WIDGET_KEYS.some((key) => has(key));
  }
  const prefix = DASHBOARD_WIDGET_MODULE_PREFIX[widgetId];
  if (prefix) return hasModuleRead(has, prefix);
  return true;
}

export function hasDashboardShortcutAccess(
  has: (key: RestaurantPermissionKey) => boolean,
  shortcutId: DashboardShortcutId,
): boolean {
  const prefix = DASHBOARD_SHORTCUT_MODULE_PREFIX[shortcutId];
  return hasModuleRead(has, prefix);
}

export function effectiveDashboardWidgetVisibility(
  visibility: Record<DashboardWidgetId, boolean>,
  has: (key: RestaurantPermissionKey) => boolean,
  options: DashboardWidgetAccessOptions,
): Record<DashboardWidgetId, boolean> {
  const out = { ...visibility };
  for (const id of Object.keys(out) as DashboardWidgetId[]) {
    if (!visibility[id]) continue;
    out[id] = hasDashboardWidgetAccess(has, id, options);
  }
  return out;
}

export function effectiveDashboardShortcutVisibility(
  visibility: Record<DashboardShortcutId, boolean>,
  has: (key: RestaurantPermissionKey) => boolean,
  permissionsLoading: boolean,
): Record<DashboardShortcutId, boolean> {
  const out = { ...visibility };
  for (const id of Object.keys(out) as DashboardShortcutId[]) {
    if (!visibility[id]) continue;
    out[id] =
      permissionsLoading || hasDashboardShortcutAccess(has, id);
  }
  return out;
}
