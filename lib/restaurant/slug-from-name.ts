/** URL-safe slug for `restaurants.slug` (lowercase, hyphens, max length). */
export function restaurantSlugFromName(name: string): string {
  const raw = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return raw.slice(0, 48) || "restaurant";
}
