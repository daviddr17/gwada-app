import "server-only";

/** Kurzlebiges In-Memory-Cache für Lexware-GETs (entlastet Rate-Limits pro Server-Prozess). */
const store = new Map<string, { expiresAt: number; payload: unknown }>();

export const LEXOFFICE_DETAIL_CACHE_MS = 30 * 60 * 1000;
export const LEXOFFICE_LIST_CACHE_MS = 15 * 60 * 1000;
export const LEXOFFICE_FILE_CACHE_MS = 30 * 60 * 1000;
/** Mindestabstand zwischen vollständigen Lexware-Sync-Läufen (pro Connector-Scope in DB). */
export const LEXOFFICE_SYNC_COOLDOWN_MS = 30 * 60 * 1000;
/** Nach HTTP 429: keine Lexware-Requests mehr für diese Dauer (pro Server-Prozess). */
export const LEXOFFICE_RATE_LIMIT_COOLDOWN_MS = 45 * 60 * 1000;
/** Pause zwischen Detail-Abrufen innerhalb eines Sync-Laufs. */
export const LEXOFFICE_DETAIL_FETCH_DELAY_MS = 250;
/** Max. Detail-Abrufe pro Sync — Rest folgt im nächsten Lauf. */
export const LEXOFFICE_MAX_DETAIL_FETCHES_PER_SYNC = 15;

const rateLimitUntilByRestaurant = new Map<string, number>();

export function markLexofficeRateLimited(restaurantId: string): void {
  rateLimitUntilByRestaurant.set(
    restaurantId,
    Date.now() + LEXOFFICE_RATE_LIMIT_COOLDOWN_MS,
  );
}

export function isLexofficeRateLimited(restaurantId: string): boolean {
  const until = rateLimitUntilByRestaurant.get(restaurantId);
  if (!until) return false;
  if (Date.now() > until) {
    rateLimitUntilByRestaurant.delete(restaurantId);
    return false;
  }
  return true;
}

export function lexofficeCacheKey(restaurantId: string, path: string): string {
  return `${restaurantId}:${path}`;
}

export function getLexofficeCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.payload as T;
}

export function setLexofficeCache(
  key: string,
  payload: unknown,
  ttlMs: number,
): void {
  store.set(key, { expiresAt: Date.now() + ttlMs, payload });
}

export function invalidateLexofficeCachePrefix(
  restaurantId: string,
  pathPrefix: string,
): void {
  const prefix = `${restaurantId}:${pathPrefix}`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
