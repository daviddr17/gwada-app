/** Stabiler WAHA-Session-Name pro Restaurant (nur alphanumerisch). */
export function wahaSessionNameForRestaurant(restaurantId: string): string {
  const compact = restaurantId.replace(/[^a-zA-Z0-9]/g, "");
  return `gwada${compact.slice(0, 48)}`;
}
