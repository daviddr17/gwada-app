import "server-only";

import { fetchContactConversationsAdmin } from "@/lib/contact-messages/fetch-contact-conversations-admin";
import { enrichConversationPreviewAvatars } from "@/lib/contact-messages/enrich-conversation-preview-avatars";
import { enrichConversationsWithFollowUps } from "@/lib/contact-messages/conversation-follow-ups-server";
import {
  resolveRestaurantChannelConnectionsServer,
  type RestaurantChannelConnectionsPayload,
} from "@/lib/contact-messages/restaurant-channel-connections-server";
import { mergeInboxConversationPreviews } from "@/lib/contact-messages/unified-inbox-merge";
import { enrichUnifiedInboxReadStateServer } from "@/lib/contact-messages/unified-inbox-read-state";
import { inboxQueryPlatformsForChannels } from "@/lib/contact-messages/inbox-query-platforms";
import { resolveCanAccessSharedEmailInbox } from "@/lib/email/resolve-shared-inbox-access-server";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LoadInboxConversationsServerResult = {
  conversations: ContactConversationPreview[];
  channels: RestaurantChannelConnectionsPayload;
};

async function fetchPlatformConversationsAdmin(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    platform: ContactMessagePlatform;
    viewerUserId: string;
    includeSharedEmail: boolean;
  },
): Promise<ContactConversationPreview[]> {
  const rows = await fetchContactConversationsAdmin(admin, {
    restaurantId: params.restaurantId,
    platform: params.platform,
    viewerUserId: params.viewerUserId,
    includeSharedEmail: params.includeSharedEmail,
  });
  return enrichConversationPreviewAvatars(admin, rows);
}

/**
 * Posteingang nur aus contact_messages (inkl. Facebook/Instagram).
 * Meta-Chats kommen per Connect-Historie, täglichem Sync und (nach Review)
 * Webhooks in die DB — kein Live-Graph beim Öffnen der Inbox.
 */
export async function loadInboxConversationsServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    supabase: SupabaseClient;
    platform?: ContactMessagePlatform;
  },
): Promise<LoadInboxConversationsServerResult> {
  const [channels, sharedAccess] = await Promise.all([
    resolveRestaurantChannelConnectionsServer({
      restaurantId: params.restaurantId,
      supabase: params.supabase,
    }),
    resolveCanAccessSharedEmailInbox({
      admin,
      restaurantId: params.restaurantId,
      userId: params.userId,
      userClient: params.supabase,
    }),
  ]);

  const platforms = inboxQueryPlatformsForChannels(channels, params.platform);
  const sources = await Promise.all(
    platforms.map((platform) =>
      fetchPlatformConversationsAdmin(admin, {
        restaurantId: params.restaurantId,
        platform,
        viewerUserId: params.userId,
        includeSharedEmail: sharedAccess.canAccessShared,
      }),
    ),
  );

  const merged = mergeInboxConversationPreviews(sources);

  const withReads = await enrichUnifiedInboxReadStateServer(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    conversations: merged,
  });

  const conversations = await enrichConversationsWithFollowUps(admin, {
    restaurantId: params.restaurantId,
    conversations: withReads,
  });

  return { conversations, channels };
}
