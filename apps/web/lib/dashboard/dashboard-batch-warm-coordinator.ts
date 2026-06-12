"use client";

/** Nach Batch-Summary: Inbox-Warm überspringen, um WAHA-Doppel-Fetch zu vermeiden. */
const BATCH_MESSAGES_WARM_SKIP_MS = 30_000;

const lastBatchMessagesAt = new Map<string, number>();

export function markDashboardBatchMessagesFetched(restaurantId: string): void {
  lastBatchMessagesAt.set(restaurantId, Date.now());
}

export function shouldSkipInboxWarmAfterBatch(
  restaurantId: string,
  windowMs = BATCH_MESSAGES_WARM_SKIP_MS,
): boolean {
  const at = lastBatchMessagesAt.get(restaurantId);
  if (!at) return false;
  return Date.now() - at < windowMs;
}
