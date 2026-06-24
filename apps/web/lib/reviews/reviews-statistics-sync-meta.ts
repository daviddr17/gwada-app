import type { PlatformFeedSyncStatusMeta } from "@/components/platform-feed/platform-feed-sync-status-bar";
import type { ReviewStatisticsBundle } from "@/lib/supabase/reviews-analytics-db";

export function reviewsStatisticsBundleSyncToMeta(
  sync: ReviewStatisticsBundle["sync"] | undefined,
): PlatformFeedSyncStatusMeta | null {
  if (!sync) return null;

  const platformErrors: Partial<Record<string, string>> = {};
  let lastSyncedAt: string | null = null;

  for (const platform of ["google", "facebook"] as const) {
    const entry = sync[platform];
    if (entry.lastError) {
      platformErrors[platform] = entry.lastError;
    }
    if (entry.syncedAt) {
      if (!lastSyncedAt || new Date(entry.syncedAt) > new Date(lastSyncedAt)) {
        lastSyncedAt = entry.syncedAt;
      }
    }
  }

  const stale =
    sync.syncTriggered || sync.google.stale || sync.facebook.stale;

  if (!stale && !lastSyncedAt) return null;

  return { lastSyncedAt, stale, platformErrors };
}
