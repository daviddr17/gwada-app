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

export function normalizeRestaurantSlugInput(input: string): string {
  return restaurantSlugFromName(input);
}

export function validateRestaurantSlugInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return "Bitte einen Nickname eintragen.";
  }
  const slug = normalizeRestaurantSlugInput(trimmed);
  if (slug.length < 2) {
    return "Nickname muss mindestens 2 Zeichen ergeben (nach Normalisierung).";
  }
  if (slug === "restaurant") {
    return "Bitte einen spezifischeren Nickname wählen.";
  }
  return null;
}

export const RESTAURANT_SLUG_TAKEN_MESSAGE =
  "Dieser Nickname ist bereits vergeben. Bitte einen anderen wählen.";
