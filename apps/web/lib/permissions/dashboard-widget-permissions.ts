import {
  hasBillingFeature,
  hasSidebarModuleBillingAccess,
  type RestaurantEntitlements,
} from "@/lib/billing/entitlements";
import type { BillingFeatureKey } from "@/lib/billing/plan-catalog";
import type { DashboardWidgetId } from "@/lib/constants/dashboard-widgets";
import type { DashboardShortcutId } from "@/lib/constants/dashboard-shortcuts";
import type { SidebarModuleId } from "@/lib/constants/sidebar-modules";
import {
  hasModuleRead,
  type ModuleCrudPrefix,
} from "@/lib/permissions/module-crud-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { hasPosModuleAccess } from "@/lib/permissions/sidebar-module-permissions";

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
  events: "events",
  news: "news",
  insights: "insights",
  accounting: "accounting",
  documents: "documents",
};

/** Widget → Sidebar-Modul für Abo-Gates (wie Sidebar-Upsell). */
const DASHBOARD_WIDGET_SIDEBAR_MODULE: Partial<
  Record<DashboardWidgetId, SidebarModuleId>
> = {
  menu: "menu",
  reservations: "reservierungen",
  reviews: "bewertungen",
  staff: "mitarbeiter",
  contacts: "kontakte",
  messages: "kontakte",
  inventory: "inventory",
  pos: "pos",
  events: "events",
  news: "news",
  insights: "insights",
  gallery: "galerie",
  accounting: "buchfuehrung",
  documents: "dokumente",
  checklists: "checklisten",
};

const GALLERY_WIDGET_KEYS: RestaurantPermissionKey[] = [
  "gallery.read",
  "gallery.create",
  "gallery.update",
  "gallery.delete",
];

const INTEGRATION_WIDGET_KEYS: RestaurantPermissionKey[] = [
  "integrations.whatsapp",
  "integrations.email",
  "integrations.facebook",
  "integrations.instagram",
  "integrations.google_business",
  "integrations.lexoffice",
  "integrations.tripadvisor",
  "settings.restaurant",
];

const INTEGRATION_BILLING_FEATURES: readonly BillingFeatureKey[] = [
  "integrations.email",
  "integrations.google_business",
  "integrations.social",
  "integrations.whatsapp",
  "integrations.lexoffice",
  "integrations.tripadvisor",
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

const DASHBOARD_SHORTCUT_SIDEBAR_MODULE: Record<
  DashboardShortcutId,
  SidebarModuleId
> = {
  reservation: "reservierungen",
  menu_dish: "menu",
  inventory_ingredient: "inventory",
  contact: "kontakte",
  document: "dokumente",
  staff_member: "mitarbeiter",
  staff_shift: "mitarbeiter",
  staff_work_entry: "mitarbeiter",
  shift_template: "mitarbeiter",
  review_invite: "bewertungen",
};

export type DashboardWidgetAccessOptions = {
  permissionsLoading?: boolean;
  weatherAvailable?: boolean;
  weatherLoading?: boolean;
  /** Restaurant-Abo; null/undefined = fail-open (wie `hasBillingFeature`). */
  entitlements?: RestaurantEntitlements | null;
};

function hasWidgetBillingAccess(
  widgetId: DashboardWidgetId,
  entitlements: RestaurantEntitlements | null | undefined,
): boolean {
  if (widgetId === "weather" || widgetId === "heute") return true;
  if (widgetId === "integrations") {
    if (!entitlements?.enforcing) return true;
    return INTEGRATION_BILLING_FEATURES.some((feature) =>
      hasBillingFeature(entitlements, feature),
    );
  }
  const moduleId = DASHBOARD_WIDGET_SIDEBAR_MODULE[widgetId];
  if (!moduleId) return true;
  return hasSidebarModuleBillingAccess(entitlements, moduleId);
}

function hasRoleAndBillingModule(
  has: (key: RestaurantPermissionKey) => boolean,
  prefix: ModuleCrudPrefix,
  moduleId: SidebarModuleId,
  entitlements: RestaurantEntitlements | null | undefined,
): boolean {
  return (
    hasModuleRead(has, prefix) &&
    hasSidebarModuleBillingAccess(entitlements, moduleId)
  );
}

/** Modul-Lese-Rechte ∩ Abo (wie Sidebar-Vollzugriff); Wetter = Plattform-Flag. */
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
    const entitlements = options?.entitlements;
    return (
      hasRoleAndBillingModule(
        has,
        "reservations",
        "reservierungen",
        entitlements,
      ) ||
      hasRoleAndBillingModule(has, "staff", "mitarbeiter", entitlements) ||
      hasRoleAndBillingModule(has, "contacts", "kontakte", entitlements) ||
      hasRoleAndBillingModule(has, "inventory", "inventory", entitlements) ||
      hasRoleAndBillingModule(has, "reviews", "bewertungen", entitlements) ||
      options?.weatherAvailable === true
    );
  }
  if (options?.permissionsLoading) return true;
  if (widgetId === "integrations") {
    if (!INTEGRATION_WIDGET_KEYS.some((key) => has(key))) return false;
    return hasWidgetBillingAccess(widgetId, options?.entitlements);
  }
  if (widgetId === "pos") {
    if (!hasPosModuleAccess(has)) return false;
    // Coming-soon-Kachel bleibt sichtbar; Live-KPIs nur für Superadmin in der Tile.
    return true;
  }
  if (widgetId === "gallery") {
    if (!GALLERY_WIDGET_KEYS.some((key) => has(key))) return false;
    return hasWidgetBillingAccess(widgetId, options?.entitlements);
  }
  if (widgetId === "checklists") {
    if (
      !(
        hasModuleRead(has, "staff_todos") || hasModuleRead(has, "compliance")
      )
    ) {
      return false;
    }
    return hasWidgetBillingAccess(widgetId, options?.entitlements);
  }
  const prefix = DASHBOARD_WIDGET_MODULE_PREFIX[widgetId];
  if (prefix && !hasModuleRead(has, prefix)) return false;
  return hasWidgetBillingAccess(widgetId, options?.entitlements);
}

export function hasDashboardShortcutAccess(
  has: (key: RestaurantPermissionKey) => boolean,
  shortcutId: DashboardShortcutId,
  entitlements?: RestaurantEntitlements | null,
): boolean {
  const prefix = DASHBOARD_SHORTCUT_MODULE_PREFIX[shortcutId];
  if (!hasModuleRead(has, prefix)) return false;
  const moduleId = DASHBOARD_SHORTCUT_SIDEBAR_MODULE[shortcutId];
  return hasSidebarModuleBillingAccess(entitlements, moduleId);
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
  entitlements?: RestaurantEntitlements | null,
): Record<DashboardShortcutId, boolean> {
  const out = { ...visibility };
  for (const id of Object.keys(out) as DashboardShortcutId[]) {
    if (!visibility[id]) continue;
    out[id] =
      permissionsLoading ||
      hasDashboardShortcutAccess(has, id, entitlements);
  }
  return out;
}
