/** Öffentliche Profil-URL: `gwada.app/{slug}` */
export function publicRestaurantProfilePath(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return `/${encodeURIComponent(normalized)}`;
}

export function publicRestaurantProfileAbsoluteUrl(
  slug: string,
  origin?: string,
): string {
  const path = publicRestaurantProfilePath(slug);
  const base = origin?.replace(/\/+$/, "") ?? "";
  return base ? `${base}${path}` : path;
}
