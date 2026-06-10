import "server-only";

/** Kurzlebiges In-Memory-Cache für Lexware-GETs (entlastet Rate-Limits pro Server-Prozess). */
const store = new Map<string, { expiresAt: number; payload: unknown }>();

export const LEXOFFICE_DETAIL_CACHE_MS = 10 * 60 * 1000;
export const LEXOFFICE_LIST_CACHE_MS = 5 * 60 * 1000;
export const LEXOFFICE_FILE_CACHE_MS = 30 * 60 * 1000;
export const LEXOFFICE_SYNC_COOLDOWN_MS = 15 * 60 * 1000;

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
