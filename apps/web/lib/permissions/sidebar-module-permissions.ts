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
    events: "events",
    kontakte: "contacts",
    news: "news",
    bewertungen: "reviews",
    galerie: null,
    buchfuehrung: "accounting",
    dokumente: "documents",
    mitarbeiter: "staff",
  };

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
  const prefix = SIDEBAR_MODULE_CRUD_PREFIX[moduleId];
  if (prefix) {
    return hasModuleRead(has, prefix);
  }
  if (moduleId === "galerie") {
    return GALLERY_READ_KEYS.some((key) => has(key));
  }
  return true;
}
