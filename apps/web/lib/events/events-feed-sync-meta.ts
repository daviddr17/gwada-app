import type { EventsCacheablePlatform } from "@/lib/constants/events-platforms";

export type EventsFeedSyncMeta = {
  lastSyncedAt: string | null;
  stale: boolean;
  platformErrors: Partial<Record<EventsCacheablePlatform, string>>;
  platformItemCounts: Partial<Record<EventsCacheablePlatform, number>>;
};
