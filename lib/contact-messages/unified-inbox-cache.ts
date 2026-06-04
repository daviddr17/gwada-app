"use client";

import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

const cache = new Map<string, ContactConversationPreview[]>();

export function setUnifiedInboxCache(
  restaurantId: string,
  conversations: ContactConversationPreview[],
): void {
  cache.set(restaurantId, conversations);
}

export function peekUnifiedInboxCache(
  restaurantId: string,
): ContactConversationPreview[] | null {
  return cache.get(restaurantId) ?? null;
}

export function clearUnifiedInboxCache(restaurantId?: string): void {
  if (restaurantId) cache.delete(restaurantId);
  else cache.clear();
}
