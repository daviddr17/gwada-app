import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";

/** Module mit Ansehen / Anlegen / Bearbeiten / Löschen (ohne `.manage`). */
export const MODULE_CRUD_PREFIXES = [
  "menu",
  "inventory",
  "reservations",
  "contacts",
  "news",
  "events",
  "reviews",
  "insights",
  "documents",
  "staff",
  "staff_todos",
  "accounting",
  "compliance",
] as const;

export type ModuleCrudPrefix = (typeof MODULE_CRUD_PREFIXES)[number];

export type ModuleCrudOperation = "read" | "create" | "update" | "delete";

export function moduleCrudKey(
  prefix: ModuleCrudPrefix,
  operation: ModuleCrudOperation,
): RestaurantPermissionKey {
  return `${prefix}.${operation}` as RestaurantPermissionKey;
}

function hasDirect(
  has: (key: RestaurantPermissionKey) => boolean,
  key: RestaurantPermissionKey,
): boolean {
  return has(key);
}

/** Legacy `.manage` oder implizites Lesen über Schreib-Rechte. */
export function hasModuleCrud(
  has: (key: RestaurantPermissionKey) => boolean,
  prefix: ModuleCrudPrefix,
  operation: ModuleCrudOperation,
): boolean {
  const manageKey = `${prefix}.manage` as RestaurantPermissionKey;
  if (hasDirect(has, manageKey)) return true;

  if (operation === "read") {
    return (
      hasDirect(has, moduleCrudKey(prefix, "read")) ||
      hasDirect(has, moduleCrudKey(prefix, "create")) ||
      hasDirect(has, moduleCrudKey(prefix, "update")) ||
      hasDirect(has, moduleCrudKey(prefix, "delete"))
    );
  }

  return hasDirect(has, moduleCrudKey(prefix, operation));
}

export function hasModuleRead(
  has: (key: RestaurantPermissionKey) => boolean,
  prefix: ModuleCrudPrefix,
): boolean {
  return hasModuleCrud(has, prefix, "read");
}

export function hasModuleCreate(
  has: (key: RestaurantPermissionKey) => boolean,
  prefix: ModuleCrudPrefix,
): boolean {
  return hasModuleCrud(has, prefix, "create");
}

export function hasModuleUpdate(
  has: (key: RestaurantPermissionKey) => boolean,
  prefix: ModuleCrudPrefix,
): boolean {
  return hasModuleCrud(has, prefix, "update");
}

export function hasModuleDelete(
  has: (key: RestaurantPermissionKey) => boolean,
  prefix: ModuleCrudPrefix,
): boolean {
  return hasModuleCrud(has, prefix, "delete");
}

export const MODULE_CRUD_LABELS: Record<
  ModuleCrudPrefix,
  { module: string; read: string; create: string; update: string; delete: string }
> = {
  menu: {
    module: "Speisekarte",
    read: "Speisekarte: Ansehen",
    create: "Speisekarte: Anlegen",
    update: "Speisekarte: Bearbeiten",
    delete: "Speisekarte: Löschen",
  },
  inventory: {
    module: "Bestand",
    read: "Bestand: Ansehen",
    create: "Bestand: Anlegen",
    update: "Bestand: Bearbeiten",
    delete: "Bestand: Löschen",
  },
  reservations: {
    module: "Reservierungen",
    read: "Reservierungen: Ansehen",
    create: "Reservierungen: Anlegen",
    update: "Reservierungen: Bearbeiten",
    delete: "Reservierungen: Löschen",
  },
  contacts: {
    module: "Nachrichten",
    read: "Nachrichten: Ansehen",
    create: "Nachrichten: Anlegen",
    update: "Nachrichten: Bearbeiten",
    delete: "Nachrichten: Löschen",
  },
  news: {
    module: "News",
    read: "News: Ansehen",
    create: "News: Anlegen",
    update: "News: Bearbeiten",
    delete: "News: Löschen",
  },
  events: {
    module: "Events",
    read: "Events: Ansehen",
    create: "Events: Anlegen",
    update: "Events: Bearbeiten",
    delete: "Events: Löschen",
  },
  reviews: {
    module: "Bewertungen",
    read: "Bewertungen: Ansehen",
    create: "Bewertungen: Anlegen",
    update: "Bewertungen: Bearbeiten",
    delete: "Bewertungen: Löschen",
  },
  insights: {
    module: "Insights",
    read: "Insights: Ansehen",
    create: "Insights: Anlegen",
    update: "Insights: Bearbeiten",
    delete: "Insights: Löschen",
  },
  documents: {
    module: "Dokumente",
    read: "Dokumente: Ansehen",
    create: "Dokumente: Anlegen",
    update: "Dokumente: Bearbeiten",
    delete: "Dokumente: Löschen",
  },
  staff: {
    module: "Mitarbeiter",
    read: "Mitarbeiter: Ansehen",
    create: "Mitarbeiter: Anlegen",
    update: "Mitarbeiter: Bearbeiten",
    delete: "Mitarbeiter: Löschen",
  },
  staff_todos: {
    module: "ToDo-Listen",
    read: "ToDo-Listen: Ansehen",
    create: "ToDo-Listen: Anlegen",
    update: "ToDo-Listen: Bearbeiten",
    delete: "ToDo-Listen: Löschen",
  },
  accounting: {
    module: "Buchführung",
    read: "Buchführung: Ansehen",
    create: "Buchführung: Anlegen",
    update: "Buchführung: Bearbeiten",
    delete: "Buchführung: Löschen",
  },
  compliance: {
    module: "Eigenkontrolle",
    read: "Eigenkontrolle: Ansehen",
    create: "Eigenkontrolle: Anlegen",
    update: "Eigenkontrolle: Bearbeiten",
    delete: "Eigenkontrolle: Löschen",
  },
};
