import type { GwadaEmbedWidgetId } from "@/lib/embed/embed-protocol";

/** Module, die per Public API (read) verfügbar sind — analog zu Embed-Widgets. */
export const RESTAURANT_API_MODULE_IDS = [
  "menu",
  "reservation",
  "reviews",
  "news",
  "events",
  "gallery",
  "opening_hours",
] as const;

export type RestaurantApiModuleId = (typeof RESTAURANT_API_MODULE_IDS)[number];

export type RestaurantApiModuleMeta = {
  id: RestaurantApiModuleId;
  label: string;
  /** Pfad unter /api/v1/… */
  path: string;
  docsPath: string;
  embedWidgetId: GwadaEmbedWidgetId;
};

export const RESTAURANT_API_MODULES: readonly RestaurantApiModuleMeta[] = [
  {
    id: "menu",
    label: "Speisekarte",
    path: "menu",
    docsPath: "/docs/api/menu",
    embedWidgetId: "menu",
  },
  {
    id: "reservation",
    label: "Reservierung",
    path: "reservation",
    docsPath: "/docs/api/reservation",
    embedWidgetId: "reservation",
  },
  {
    id: "reviews",
    label: "Bewertungen",
    path: "reviews",
    docsPath: "/docs/api/reviews",
    embedWidgetId: "reviews",
  },
  {
    id: "news",
    label: "News",
    path: "news",
    docsPath: "/docs/api/news",
    embedWidgetId: "news",
  },
  {
    id: "events",
    label: "Events",
    path: "events",
    docsPath: "/docs/api/events",
    embedWidgetId: "events",
  },
  {
    id: "gallery",
    label: "Galerie",
    path: "gallery",
    docsPath: "/docs/api/gallery",
    embedWidgetId: "gallery",
  },
  {
    id: "opening_hours",
    label: "Öffnungszeiten",
    path: "opening-hours",
    docsPath: "/docs/api/opening-hours",
    embedWidgetId: "opening_hours",
  },
] as const;

const MODULE_BY_ID = new Map(
  RESTAURANT_API_MODULES.map((m) => [m.id, m] as const),
);

const MODULE_BY_PATH = new Map(
  RESTAURANT_API_MODULES.map((m) => [m.path, m] as const),
);

export function restaurantApiModuleById(
  id: string | null | undefined,
): RestaurantApiModuleMeta | null {
  if (!id) return null;
  return MODULE_BY_ID.get(id as RestaurantApiModuleId) ?? null;
}

export function restaurantApiModuleByPath(
  path: string | null | undefined,
): RestaurantApiModuleMeta | null {
  if (!path) return null;
  return MODULE_BY_PATH.get(path.trim().toLowerCase()) ?? null;
}

export function isRestaurantApiModuleId(
  value: string,
): value is RestaurantApiModuleId {
  return (RESTAURANT_API_MODULE_IDS as readonly string[]).includes(value);
}

export function normalizeRestaurantApiModuleIds(
  raw: unknown,
): RestaurantApiModuleId[] {
  if (!Array.isArray(raw)) return [];
  const out: RestaurantApiModuleId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim() as RestaurantApiModuleId;
    if (isRestaurantApiModuleId(id) && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}
