"use client";

import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

export type ContactThreadCacheEntry = {
  messages: ContactMessageRow[];
  contactName: string;
  hasPhone: boolean;
  hasEmail: boolean;
  whatsappThreadChatId: string | null;
  cachedAt: number;
};

const cache = new Map<string, ContactThreadCacheEntry>();

function cacheKey(restaurantId: string, contactId: string): string {
  return `${restaurantId}:${contactId}`;
}

export function peekContactThreadCache(
  restaurantId: string,
  contactId: string,
): ContactThreadCacheEntry | null {
  return cache.get(cacheKey(restaurantId, contactId)) ?? null;
}

export function setContactThreadCache(
  restaurantId: string,
  contactId: string,
  entry: Omit<ContactThreadCacheEntry, "cachedAt">,
): void {
  cache.set(cacheKey(restaurantId, contactId), {
    ...entry,
    cachedAt: Date.now(),
  });
}

export function clearContactThreadCache(restaurantId?: string): void {
  if (!restaurantId) {
    cache.clear();
    return;
  }
  const prefix = `${restaurantId}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
