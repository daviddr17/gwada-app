/**
 * Erste URL-Segmente, die nicht als Restaurant-Nickname (`restaurants.slug`) vergeben
 * werden dürfen — schützt bestehende App-Routen vor Kollisionen mit `app/[slug]`.
 */
export const RESERVED_RESTAURANT_SLUGS = new Set([
  // Infrastruktur / öffentliche Gast-Routen
  "api",
  "bewertung",
  "display",
  "einladung",
  "embed",
  "nachrichten",
  "sb",
  // Marketing & Auth
  "login",
  "auth",
  "docs",
  "impressum",
  "datenschutz",
  // App-Zonen (eingeloggt)
  "dashboard",
  "profile",
  "settings",
  "superadmin",
  "workspace",
  "changelog",
  // Geplant / generisch
  "kontakt",
  "restaurant",
  "admin",
  "app",
  "www",
  "help",
  "support",
  "static",
  "public",
]);

export function isReservedRestaurantSlug(slug: string): boolean {
  return RESERVED_RESTAURANT_SLUGS.has(slug.trim().toLowerCase());
}

/** Einzelnes Segment `/nickname` — kein verschachtelter Pfad. */
export function parsePublicRestaurantProfileSlug(pathname: string): string | null {
  const normalized = pathname.split("?")[0]?.replace(/\/+$/, "") ?? "";
  if (!normalized.startsWith("/")) return null;
  const segment = normalized.slice(1);
  if (!segment || segment.includes("/")) return null;
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(segment)) return null;
  if (isReservedRestaurantSlug(segment)) return null;
  return segment;
}

export function isPublicRestaurantProfilePath(pathname: string): boolean {
  return parsePublicRestaurantProfileSlug(pathname) !== null;
}
