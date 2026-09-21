import "server-only";

import { inboxQueryPlatformsFromConnectionFlags } from "@/lib/contact-messages/inbox-query-platforms";
import { CONVERSATION_LIST_MESSAGE_ROW_LIMIT } from "@/lib/contact-messages/conversation-list-limits";
import { fetchContactConversationsAdmin } from "@/lib/contact-messages/fetch-contact-conversations-admin";
import { mergeInboxConversationPreviews } from "@/lib/contact-messages/unified-inbox-merge";
import { enrichUnifiedInboxReadStateServer } from "@/lib/contact-messages/unified-inbox-read-state";
import { enrichConversationsWithFollowUps } from "@/lib/contact-messages/conversation-follow-ups-server";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

type UnifiedInboxParams = {
  restaurantId: string;
  userId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected?: boolean;
  instagramConnected?: boolean;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;
  facebookEnabled?: boolean;
  instagramEnabled?: boolean;
};

async function fetchUnifiedInboxFromDbAdmin(
  admin: SupabaseClient,
  params: UnifiedInboxParams,
  options?: { light?: boolean; rowLimit?: number },
): Promise<ContactConversationPreview[]> {
  const platforms = inboxQueryPlatformsFromConnectionFlags(params);

  const sources = await Promise.all(
    platforms.map((platform) =>
      fetchContactConversationsAdmin(admin, {
        restaurantId: params.restaurantId,
        platform,
        light: options?.light,
        rowLimit: options?.rowLimit,
      }),
    ),
  );

  const merged = mergeInboxConversationPreviews(sources);
  const withReads = await enrichUnifiedInboxReadStateServer(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    conversations: merged,
  });
  return enrichConversationsWithFollowUps(admin, {
    restaurantId: params.restaurantId,
    conversations: withReads,
  });
}

export async function fetchUnifiedInboxConversationsForDashboard(
  admin: SupabaseClient,
  params: UnifiedInboxParams,
): Promise<ContactConversationPreview[]> {
  return fetchUnifiedInboxFromDbAdmin(admin, params, { light: true });
}

/**
 * Glocke / Unread-Summary: volle Zeilen-Tiefe wie Server-Inbox, aber ohne
 * Attachment-Join — korrekter Zähler nach Deploy, ohne Thread-Load zu blockieren.
 */
export async function fetchUnifiedInboxConversationsForUnreadSummary(
  admin: SupabaseClient,
  params: UnifiedInboxParams,
): Promise<ContactConversationPreview[]> {
  return fetchUnifiedInboxFromDbAdmin(admin, params, {
    light: true,
    rowLimit: CONVERSATION_LIST_MESSAGE_ROW_LIMIT,
  });
}

export async function fetchUnifiedInboxConversationsServer(
  admin: SupabaseClient,
  params: UnifiedInboxParams,
): Promise<ContactConversationPreview[]> {
  return fetchUnifiedInboxFromDbAdmin(admin, params);
}
