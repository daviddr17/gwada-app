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
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LoadInboxConversationsServerResult = {
  conversations: ContactConversationPreview[];
  channels: RestaurantChannelConnectionsPayload;
};

function platformsForChannels(
  channels: RestaurantChannelConnectionsPayload,
  platform?: ContactMessagePlatform,
): ContactMessagePlatform[] {
  if (platform) return [platform];

  const platforms: ContactMessagePlatform[] = ["gwada"];
  if (channels.whatsappConnected) platforms.push("whatsapp");
  if (channels.emailConnected) platforms.push("email");
  if (channels.facebookConnected) platforms.push("facebook");
  if (channels.instagramConnected) platforms.push("instagram");
  return platforms;
}

async function fetchPlatformConversationsAdmin(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    platform: ContactMessagePlatform;
  },
): Promise<ContactConversationPreview[]> {
  const rows = await fetchContactConversationsAdmin(admin, params);
  return enrichConversationPreviewAvatars(admin, rows);
}

/** Ein Server-Roundtrip: Kanäle auflösen + Konversationsliste aus DB (Admin). */
export async function loadInboxConversationsServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    supabase: SupabaseClient;
    platform?: ContactMessagePlatform;
  },
): Promise<LoadInboxConversationsServerResult> {
  const channels = await resolveRestaurantChannelConnectionsServer({
    restaurantId: params.restaurantId,
    supabase: params.supabase,
  });

  const platforms = platformsForChannels(channels, params.platform);
  const sources = await Promise.all(
    platforms.map((platform) =>
      fetchPlatformConversationsAdmin(admin, {
        restaurantId: params.restaurantId,
        platform,
      }),
    ),
  );

  const merged = params.platform
    ? (sources[0] ?? [])
    : mergeInboxConversationPreviews(sources);

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
