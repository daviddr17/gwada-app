/** Shared helpers (no server-only) for client serial + location labels. */

export function fiskalyClientSerialFromRestaurant(
  slug: string,
  restaurantId: string,
): string {
  const sanitized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const uniqueSuffix = restaurantId
    .replace(/-/g, "")
    .slice(0, 8)
    .toLowerCase();
  const serial = `gwada-${sanitized || "standort"}-${uniqueSuffix}`.slice(0, 70);
  return serial.replace(/[/_]/g, "-");
}

export function formatFiskalyLocationLabel(row: {
  name: string;
  city?: string | null;
  country?: string | null;
  address_line1?: string | null;
}): string {
  const geo = [row.city?.trim(), row.country?.trim()].filter(Boolean).join(", ");
  const addr = row.address_line1?.trim();
  if (geo && addr) return `${row.name} · ${geo} (${addr})`;
  if (geo) return `${row.name} · ${geo}`;
  if (addr) return `${row.name} · (${addr})`;
  return row.name;
}
