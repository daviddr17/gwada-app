"use client";

import type { InboxPlatformFilter } from "@/lib/constants/contact-message-platforms";
import { INBOX_FILTER_ALL } from "@/lib/constants/contact-message-platforms";
import {
  fetchEmailConversationsClient,
  fetchMetaConversationsClient,
  fetchWahaConversationsClient,
  markConversationReadClient,
} from "@/lib/contact-messages/fetch-inbox-client";
import { mergeInboxConversationPreviews } from "@/lib/contact-messages/unified-inbox-merge";
import { setUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { enrichOneConversationWithReads } from "@/lib/contact-messages/unified-inbox-read-state";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import { parseMetaPseudoContactId } from "@/lib/contact-messages/meta-pseudo-contact";
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

  const [gwada, whatsapp, email, facebook, instagram] = await Promise.all([
    readsMapForPlatform(params.restaurantId, user.id, "gwada"),
    readsMapForPlatform(params.restaurantId, user.id, "whatsapp"),
    readsMapForPlatform(params.restaurantId, user.id, "email"),
    readsMapForPlatform(params.restaurantId, user.id, "facebook"),
    readsMapForPlatform(params.restaurantId, user.id, "instagram"),
  ]);

  return params.conversations.map((c) =>
    enrichOneConversationWithReads(c, {
      gwada,
      whatsapp,
      email,
      facebook,
      instagram,
    }),
  );
}

export async function fetchUnifiedInboxConversations(params: {
  restaurantId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected?: boolean;
  instagramConnected?: boolean;
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

  if (params.facebookConnected) {
    const fb = await fetchMetaConversationsClient(
      params.restaurantId,
      "facebook",
    );
    if (!fb.error) sources.push(fb.data);
  }

  if (params.instagramConnected) {
    const ig = await fetchMetaConversationsClient(
      params.restaurantId,
      "instagram",
    );
    if (!ig.error) sources.push(ig.data);
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
  whatsappConnected?: boolean;
  emailConnected?: boolean;
}): Promise<{ ok: boolean; error: string | null }> {
  return markConversationReadClient({
    restaurantId: params.restaurantId,
    conversationKey: params.contactId,
    platform: "gwada",
  });
}

export function isUnifiedInboxFilter(filter: InboxPlatformFilter): boolean {
  return filter === INBOX_FILTER_ALL;
}
