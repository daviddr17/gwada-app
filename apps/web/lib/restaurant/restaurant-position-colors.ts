/** Palette für Restaurant-Positionen — synchron zu `restaurant_position_palette_color` in der DB. */
export const RESTAURANT_POSITION_COLOR_PALETTE = [
  "#e11d48",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#84cc16",
  "#f43f5e",
  "#0ea5e9",
] as const;

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function isRestaurantPositionHexColor(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function pickRestaurantPositionColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) | 0;
  }
  const palette = RESTAURANT_POSITION_COLOR_PALETTE;
  return palette[Math.abs(hash) % palette.length] ?? palette[0];
}

export function normalizeRestaurantPositionColor(
  value: string | null | undefined,
  fallbackSeed?: string,
): string {
  if (isRestaurantPositionHexColor(value)) return value;
  return pickRestaurantPositionColor(fallbackSeed ?? crypto.randomUUID());
}

/** Abgeschwächte Border-/Tint-Farben für Positions-Karten (wie Schichtplan-Gruppen). */
export function restaurantPositionSurfaceStyle(color: string): {
  borderColor: string;
  backgroundColor: string;
} {
  const normalized = isRestaurantPositionHexColor(color)
    ? color
    : pickRestaurantPositionColor(color);
  return {
    borderColor: `${normalized}44`,
    backgroundColor: `${normalized}16`,
  };
}
