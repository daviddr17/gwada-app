import type { QueryClient } from "@tanstack/react-query";

/** Inaktive Queries behalten — darüber prune für 8–12h-Tabs. */
const INACTIVE_QUERY_SOFT_CAP = 48;
/** Älter als das und ohne Observer → Kandidat für Prune. */
const INACTIVE_MIN_AGE_MS = 12 * 60_000;

/**
 * Begrenzt Query-Cache-Wachstum bei Dauerbetrieb.
 * Nur Observer-lose Einträge; aktive Modul-Caches bleiben.
 */
export function pruneInactiveAppQueries(client: QueryClient): number {
  const cache = client.getQueryCache();
  const inactive = cache
    .getAll()
    .filter((q) => q.getObserversCount() === 0)
    .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);

  if (inactive.length <= INACTIVE_QUERY_SOFT_CAP) {
    const now = Date.now();
    let removed = 0;
    for (const q of inactive) {
      if (now - q.state.dataUpdatedAt < INACTIVE_MIN_AGE_MS) continue;
      cache.remove(q);
      removed += 1;
    }
    return removed;
  }

  const overflow = inactive.length - INACTIVE_QUERY_SOFT_CAP;
  let removed = 0;
  for (let i = 0; i < overflow; i++) {
    const q = inactive[i];
    if (!q) break;
    cache.remove(q);
    removed += 1;
  }
  return removed;
}
