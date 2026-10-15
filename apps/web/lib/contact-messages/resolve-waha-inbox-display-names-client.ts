"use client";

import { fetchWahaDisplayNameClient } from "@/lib/contact-messages/fetch-inbox-client";
import {
  needsWahaDisplayNameResolve,
  pickReadableName,
} from "@/lib/contact-messages/waha-chat-label";
import {
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

const RESOLVE_CONCURRENCY = 4;

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

function needsWhatsappDisplayNameResolve(
  conversation: ContactConversationPreview,
): boolean {
  if (conversation.platform !== "whatsapp") return false;
  if (!isWahaPseudoContactId(conversation.contact_id)) return false;
  return needsWahaDisplayNameResolve(conversation.contact_name ?? "");
}

/**
 * For phone-like WAHA pseudo threads, ask the server for business/verified
 * names and patch the list. The display-name API also persists labels in DB.
 */
export async function resolveWahaInboxDisplayNamesClient(params: {
  restaurantId: string;
  conversations: ContactConversationPreview[];
}): Promise<{
  conversations: ContactConversationPreview[];
  changed: boolean;
}> {
  const pending = params.conversations.filter(needsWhatsappDisplayNameResolve);
  if (pending.length === 0) {
    return { conversations: params.conversations, changed: false };
  }

  const resolvedPairs = await mapPool(
    pending,
    RESOLVE_CONCURRENCY,
    async (conversation) => {
      const chatId = wahaChatIdFromPseudoContactId(conversation.contact_id);
      if (!chatId) return null;
      const { displayName } = await fetchWahaDisplayNameClient({
        restaurantId: params.restaurantId,
        chatId,
      });
      const readable = pickReadableName(displayName);
      if (!readable) return null;
      return { contactId: conversation.contact_id, displayName: readable };
    },
  );

  const byId = new Map<string, string>();
  for (const pair of resolvedPairs) {
    if (pair) byId.set(pair.contactId, pair.displayName);
  }
  if (byId.size === 0) {
    return { conversations: params.conversations, changed: false };
  }

  const conversations = params.conversations.map((conversation) => {
    const next = byId.get(conversation.contact_id);
    if (!next) return conversation;
    return { ...conversation, contact_name: next };
  });

  return { conversations, changed: true };
}
