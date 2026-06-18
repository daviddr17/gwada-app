"use client";

import { patchInboxConversationsFromInboundMessage } from "@/lib/contact-messages/patch-inbox-from-message-row";
import {
  peekUnifiedInboxCache,
  setUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-cache";
import type {
  ContactConversationPreview,
  ContactMessageRow,
} from "@/lib/supabase/contact-messages-db";

/** Realtime: inbound in Unified-Inbox-Cache mergen (löst CACHE_UPDATED aus). */
export function applyInboundMessageToInboxCache(
  restaurantId: string,
  message: ContactMessageRow,
): ContactConversationPreview[] {
  const base = peekUnifiedInboxCache(restaurantId) ?? [];
  const next = patchInboxConversationsFromInboundMessage(base, message);
  setUnifiedInboxCache(restaurantId, next);
  return next;
}
