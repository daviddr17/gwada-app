import "server-only";

type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

/** Kurzer Prozess-Cache für Marketing-Assets (Logo/Favicon) — senkt LCP-TTFB. */
export function getCachedPlatformAsset<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCachedPlatformAsset<T>(
  key: string,
  value: T,
  ttlMs: number,
): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
