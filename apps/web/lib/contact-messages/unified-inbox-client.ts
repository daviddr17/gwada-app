"use client";

import type { InboxPlatformFilter } from "@/lib/constants/contact-message-platforms";
import { INBOX_FILTER_ALL } from "@/lib/constants/contact-message-platforms";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { markConversationReadClient } from "@/lib/contact-messages/fetch-inbox-client";
import { mergeInboxConversationPreviews } from "@/lib/contact-messages/unified-inbox-merge";
import { setUnifiedInboxCache } from "@/lib/contact-messages/unified-inbox-cache";
import { enrichOneConversationWithReads } from "@/lib/contact-messages/unified-inbox-read-state";
import { fetchConversationReadsBrowser } from "@/lib/supabase/contact-conversation-reads-db";
import {
  fetchContactConversations,
  type ContactConversationPreview,
} from "@/lib/supabase/contact-messages-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

/** Posteingang aus Supabase — keine Live-WAHA/IMAP/Meta-Calls beim Listen-Laden. */
export async function fetchUnifiedInboxConversations(params: {
  restaurantId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected?: boolean;
  instagramConnected?: boolean;
}): Promise<{ data: ContactConversationPreview[]; error: Error | null }> {
  const platforms: ContactMessagePlatform[] = ["gwada"];
  if (params.whatsappConnected) platforms.push("whatsapp");
  if (params.emailConnected) platforms.push("email");
  if (params.facebookConnected) platforms.push("facebook");
  if (params.instagramConnected) platforms.push("instagram");

  const results = await Promise.all(
    platforms.map((platform) =>
      fetchContactConversations({
        restaurantId: params.restaurantId,
        platform,
      }),
    ),
  );

  for (const result of results) {
    if (result.error) return { data: [], error: result.error };
  }

  const merged = mergeInboxConversationPreviews(results.map((r) => r.data));
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
