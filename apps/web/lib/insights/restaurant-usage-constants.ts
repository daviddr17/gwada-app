/** Gwada first-party Usage Insights (Embed / API / Profil). */

export const RESTAURANT_USAGE_SOURCES = ["embed", "api", "profile"] as const;

export type RestaurantUsageSource = (typeof RESTAURANT_USAGE_SOURCES)[number];

export function isRestaurantUsageSource(
  value: string,
): value is RestaurantUsageSource {
  return (RESTAURANT_USAGE_SOURCES as readonly string[]).includes(value);
}

/** Dimension: kebab/snake + optional prefix, max. 64 Zeichen. */
export function isRestaurantUsageDimension(value: string): boolean {
  return /^[a-z0-9_.:-]{1,64}$/.test(value);
}

export const EMBED_USAGE_DIMENSIONS = [
  "reservation",
  "menu",
  "reviews",
  "news",
  "events",
  "gallery",
  "opening_hours",
] as const;

export type EmbedUsageDimension = (typeof EMBED_USAGE_DIMENSIONS)[number];

export function isEmbedUsageDimension(
  value: string,
): value is EmbedUsageDimension {
  return (EMBED_USAGE_DIMENSIONS as readonly string[]).includes(value);
}

export const PROFILE_USAGE_VIEW_DIMENSION = "view" as const;

export function profileModuleUsageDimension(moduleId: string): string {
  return `module:${moduleId}`;
}

export function apiModuleUsageDimension(moduleId: string): string {
  return `api:${moduleId}`;
}

export const EMBED_USAGE_LABELS: Record<EmbedUsageDimension, string> = {
  reservation: "Reservieren",
  menu: "Speisekarte",
  reviews: "Bewertungen",
  news: "News",
  events: "Events",
  gallery: "Galerie",
  opening_hours: "Öffnungszeiten",
};

export const PROFILE_MODULE_USAGE_LABELS: Record<string, string> = {
  reserve: "Reservieren",
  menu: "Speisekarte",
  reviews: "Bewertungen",
  news: "News",
  events: "Events",
  gallery: "Galerie",
  info: "Info",
};

export type RestaurantUsageBreakdownRow = {
  key: string;
  label: string;
  count: number;
};

export type RestaurantUsageInsights = {
  embedViews: number;
  apiRequests: number;
  profileViews: number;
  profileModuleOpens: number;
  embedByWidget: RestaurantUsageBreakdownRow[];
  apiByModule: RestaurantUsageBreakdownRow[];
  profileByModule: RestaurantUsageBreakdownRow[];
};

export function emptyRestaurantUsageInsights(): RestaurantUsageInsights {
  return {
    embedViews: 0,
    apiRequests: 0,
    profileViews: 0,
    profileModuleOpens: 0,
    embedByWidget: [],
    apiByModule: [],
    profileByModule: [],
  };
}
