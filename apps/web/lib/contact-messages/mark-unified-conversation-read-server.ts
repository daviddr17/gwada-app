import "server-only";

import { markConversationReadServer } from "@/lib/contact-messages/mark-conversation-read-server";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { conversationChannelForRead } from "@/lib/contact-messages/unified-inbox-merge";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InboxChannelConnectionFlags = {
  emailConnected: boolean;
  whatsappConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
};

export async function resolveInboxChannelConnections(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<InboxChannelConnectionFlags> {
  const [whatsappConnected, emailConnected, facebookConnected, instagramConnected] =
    await Promise.all([
      getWahaServerConfigAdmin().then(Boolean),
      resolveRestaurantImapCredentials(admin, restaurantId).then((c) =>
        Boolean(c?.imapHost),
      ),
      fetchRestaurantOAuthIntegrationAdmin(
        restaurantId,
        "facebook",
        (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
      ).then((row) => Boolean(row && row.status === "working")),
      fetchRestaurantOAuthIntegrationAdmin(
        restaurantId,
        "instagram",
        (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
      ).then((row) => Boolean(row && row.status === "working")),
    ]);

  return {
    whatsappConnected,
    emailConnected,
    facebookConnected,
    instagramConnected,
  };
}

export function platformsToMarkForConversation(
  contactId: string,
  opts: InboxChannelConnectionFlags,
): ContactMessagePlatform[] {
  if (!isUuidRestaurantId(contactId)) {
    return [conversationChannelForRead(contactId)];
  }

  const platforms: ContactMessagePlatform[] = ["gwada"];
  if (opts.emailConnected) platforms.push("email");
  if (opts.whatsappConnected) platforms.push("whatsapp");
  if (opts.facebookConnected) platforms.push("facebook");
  if (opts.instagramConnected) platforms.push("instagram");
  return platforms;
}

/** Verknüpfte Kontakte: alle relevanten Kanäle (inkl. IMAP \\Seen) als gelesen markieren. */
export async function markUnifiedInboxConversationReadServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    channelConnections?: InboxChannelConnectionFlags;
  },
): Promise<{ error: string | null }> {
  const channelConnections =
    params.channelConnections ??
    (await resolveInboxChannelConnections(admin, params.restaurantId));

  const platforms = isLinkedContactId(params.conversationKey)
    ? platformsToMarkForConversation(params.conversationKey, channelConnections)
    : [conversationChannelForRead(params.conversationKey)];

  for (const platform of platforms) {
    const result = await markConversationReadServer(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      conversationKey: params.conversationKey,
      platform,
    });
    if (result.error) return result;
  }

  return { error: null };
}
