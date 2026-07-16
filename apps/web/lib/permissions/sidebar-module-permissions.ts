import type { SidebarModuleId } from "@/lib/constants/sidebar-modules";
import {
  hasModuleRead,
  type ModuleCrudPrefix,
} from "@/lib/permissions/module-crud-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

const SIDEBAR_MODULE_CRUD_PREFIX: Record<SidebarModuleId, ModuleCrudPrefix | null> =
  {
    menu: "menu",
    inventory: "inventory",
    reservierungen: "reservations",
    pos: null,
    events: "events",
    kontakte: "contacts",
    news: "news",
    bewertungen: "reviews",
    insights: "insights",
    galerie: null,
    buchfuehrung: "accounting",
    dokumente: "documents",
    checklisten: null,
    mitarbeiter: "staff",
  };

const POS_MODULE_KEYS: RestaurantPermissionKey[] = [
  "pos.kasse.manage",
  "pos.kasse.export",
];

/** Web-POS-Modul (Übersicht, Bestellungen, Statistiken, Einstellungen). */
export function hasPosModuleAccess(
  has: (key: RestaurantPermissionKey) => boolean,
): boolean {
  return POS_MODULE_KEYS.some((key) => has(key));
}

const GALLERY_READ_KEYS: RestaurantPermissionKey[] = [
  "gallery.read",
  "gallery.create",
  "gallery.update",
  "gallery.delete",
];

export function hasSidebarModuleAccess(
  has: (key: RestaurantPermissionKey) => boolean,
  moduleId: SidebarModuleId,
): boolean {
  if (moduleId === "checklisten") {
    return (
      hasModuleRead(has, "staff_todos") || hasModuleRead(has, "compliance")
    );
  }
  if (moduleId === "pos") {
    return hasPosModuleAccess(has);
  }
  const prefix = SIDEBAR_MODULE_CRUD_PREFIX[moduleId];
  if (prefix) {
    return hasModuleRead(has, prefix);
  }
  if (moduleId === "galerie") {
    return GALLERY_READ_KEYS.some((key) => has(key));
  }
  return true;
}
