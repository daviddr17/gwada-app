import type { ReviewsCacheablePlatform } from "@/lib/reviews/reviews-cache-constants";

export type ReviewsFeedSyncMeta = {
  lastSyncedAt: string | null;
  stale: boolean;
  platformErrors: Partial<Record<ReviewsCacheablePlatform, string>>;
};
