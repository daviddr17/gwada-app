"use client";

import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export const GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT =
  "gwada:unified-inbox-cache-updated";

type CacheEntry = {
  conversations: ContactConversationPreview[];
  cachedAt: number;
};

const cache = new Map<string, CacheEntry>();

export function setUnifiedInboxCache(
  restaurantId: string,
  conversations: ContactConversationPreview[],
): void {
  cache.set(restaurantId, {
    conversations,
    cachedAt: Date.now(),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT, {
        detail: { restaurantId },
      }),
    );
  }
}

export function peekUnifiedInboxCache(
  restaurantId: string,
): ContactConversationPreview[] | null {
  return cache.get(restaurantId)?.conversations ?? null;
}

export function peekUnifiedInboxCacheAgeMs(restaurantId: string): number | null {
  const entry = cache.get(restaurantId);
  if (!entry) return null;
  return Date.now() - entry.cachedAt;
}

export function clearUnifiedInboxCache(restaurantId?: string): void {
  if (restaurantId) cache.delete(restaurantId);
  else cache.clear();
}
