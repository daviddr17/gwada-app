"use client";

import type { InboxPlatformFilter } from "@/lib/constants/contact-message-platforms";
import { INBOX_FILTER_ALL } from "@/lib/constants/contact-message-platforms";
import {
  fetchEmailConversationsClient,
  fetchWahaConversationsClient,
} from "@/lib/contact-messages/fetch-inbox-client";
import { mergeInboxConversationPreviews } from "@/lib/contact-messages/unified-inbox-merge";
import { setUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { enrichOneConversationWithReads } from "@/lib/contact-messages/unified-inbox-read-state";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { isWahaPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { fetchConversationReadsBrowser } from "@/lib/supabase/contact-conversation-reads-db";
import {
  fetchContactConversations,
  type ContactConversationPreview,
} from "@/lib/supabase/contact-messages-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";

async function readsMapForPlatform(
  restaurantId: string,
  userId: string,
  platform: ContactMessagePlatform,
) {
  return fetchConversationReadsBrowser({ restaurantId, userId, platform });
}

export async function enrichUnifiedInboxReadState(params: {
  restaurantId: string;
  conversations: ContactConversationPreview[];
}): Promise<ContactConversationPreview[]> {
  const sb = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return params.conversations;

  const [gwada, whatsapp, email] = await Promise.all([
    readsMapForPlatform(params.restaurantId, user.id, "gwada"),
    readsMapForPlatform(params.restaurantId, user.id, "whatsapp"),
    readsMapForPlatform(params.restaurantId, user.id, "email"),
  ]);

  return params.conversations.map((c) =>
    enrichOneConversationWithReads(c, { gwada, whatsapp, email }),
  );
}

export async function fetchUnifiedInboxConversations(params: {
  restaurantId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
}): Promise<{ data: ContactConversationPreview[]; error: Error | null }> {
  const sources: ContactConversationPreview[][] = [];

  const db = await fetchContactConversations({
    restaurantId: params.restaurantId,
    platform: "gwada",
  });
  if (db.error) return { data: [], error: db.error };
  sources.push(db.data);

  if (params.whatsappConnected) {
    const wa = await fetchWahaConversationsClient(params.restaurantId);
    if (!wa.error) sources.push(wa.data);
  }

  if (params.emailConnected) {
    const em = await fetchEmailConversationsClient(params.restaurantId);
    if (!em.error) sources.push(em.data);
  }

  const merged = mergeInboxConversationPreviews(sources);
  const enriched = await enrichUnifiedInboxReadState({
    restaurantId: params.restaurantId,
    conversations: merged,
  });

  setUnifiedInboxCache(params.restaurantId, enriched);
  return { data: enriched, error: null };
}

export async function markUnifiedInboxConversationReadClient(params: {
  restaurantId: string;
  contactId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
}): Promise<{ ok: boolean; error: string | null }> {
  const { markConversationReadClient } = await import(
    "@/lib/contact-messages/fetch-inbox-client"
  );

  if (isWahaPseudoContactId(params.contactId)) {
    return markConversationReadClient({
      restaurantId: params.restaurantId,
      conversationKey: params.contactId,
      platform: "whatsapp",
    });
  }
  if (isEmailPseudoContactId(params.contactId)) {
    return markConversationReadClient({
      restaurantId: params.restaurantId,
      conversationKey: params.contactId,
      platform: "email",
    });
  }

  const tasks: Promise<{ ok: boolean; error: string | null }>[] = [
    markConversationReadClient({
      restaurantId: params.restaurantId,
      conversationKey: params.contactId,
      platform: "gwada",
    }),
  ];
  if (params.whatsappConnected) {
    tasks.push(
      markConversationReadClient({
        restaurantId: params.restaurantId,
        conversationKey: params.contactId,
        platform: "whatsapp",
      }),
    );
  }
  if (params.emailConnected) {
    tasks.push(
      markConversationReadClient({
        restaurantId: params.restaurantId,
        conversationKey: params.contactId,
        platform: "email",
      }),
    );
  }

  const results = await Promise.all(tasks);
  const failed = results.find((r) => !r.ok);
  return failed ?? { ok: true, error: null };
}

export function isUnifiedInboxFilter(filter: InboxPlatformFilter): boolean {
  return filter === INBOX_FILTER_ALL;
}
