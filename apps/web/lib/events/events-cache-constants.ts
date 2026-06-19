import type { EventsPlatform } from "@/lib/constants/events-platforms";

export const EVENTS_CACHE_STALE_MS = 10 * 60 * 1000;

export function isEventsFeedSyncStale(syncedAt: string | null | undefined): boolean {
  if (!syncedAt) return true;
  return Date.now() - new Date(syncedAt).getTime() > EVENTS_CACHE_STALE_MS;
}
