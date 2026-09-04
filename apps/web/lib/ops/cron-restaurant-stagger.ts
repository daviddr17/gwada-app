/** Verteilt Cron-Last über N Minuten-Buckets (Hash pro Restaurant). */

export function restaurantCronBucket(
  restaurantId: string,
  buckets: number,
): number {
  let hash = 0;
  for (let i = 0; i < restaurantId.length; i++) {
    hash = (hash * 31 + restaurantId.charCodeAt(i)) >>> 0;
  }
  return hash % Math.max(1, buckets);
}

export function shouldSyncRestaurantInCronSlot(
  restaurantId: string,
  buckets: number,
  slot?: number,
): boolean {
  const currentSlot =
    slot ?? Math.floor(Date.now() / 60000) % Math.max(1, buckets);
  return restaurantCronBucket(restaurantId, buckets) === currentSlot;
}
