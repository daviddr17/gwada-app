/** Google Maps Navigation (neues Fenster / App) zur Restaurant-Adresse. */
export function publicRestaurantMapsUrl(parts: {
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  country?: string | null;
}): string | null {
  const line = [
    parts.addressLine1?.trim(),
    [parts.postalCode?.trim(), parts.city?.trim()].filter(Boolean).join(" "),
    parts.country?.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  if (!line) return null;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(line)}`;
}

export function formatPublicRestaurantAddress(parts: {
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
}): string {
  return [
    parts.addressLine1?.trim(),
    [parts.postalCode?.trim(), parts.city?.trim()].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}
