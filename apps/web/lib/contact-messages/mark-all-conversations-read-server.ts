import "server-only";

import { markConversationReadServer } from "@/lib/contact-messages/mark-conversation-read-server";
import { conversationChannelForRead } from "@/lib/contact-messages/unified-inbox-merge";
import { fetchUnifiedInboxConversationsForDashboard } from "@/lib/contact-messages/unified-inbox-server";
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

async function isEmailConnected(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<boolean> {
  const creds = await resolveRestaurantImapCredentials(admin, restaurantId);
  return Boolean(creds?.imapHost);
}

async function isWhatsappConnected(): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
  return Boolean(config);
}

async function isFacebookConnected(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<boolean> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  return Boolean(row && row.status === "working");
}

async function isInstagramConnected(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<boolean> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "instagram",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  return Boolean(row && row.status === "working");
}

function platformsToMarkForConversation(
  contactId: string,
  opts: {
    emailConnected: boolean;
    whatsappConnected: boolean;
    facebookConnected: boolean;
    instagramConnected: boolean;
  },
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

/** Alle ungelesenen Konversationen im Postfach als gelesen markieren. */
export async function markAllConversationsReadForUserServer(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null }> {
  const [whatsappConnected, emailConnected, facebookConnected, instagramConnected] =
    await Promise.all([
      isWhatsappConnected(),
      isEmailConnected(admin, params.restaurantId),
      isFacebookConnected(admin, params.restaurantId),
      isInstagramConnected(admin, params.restaurantId),
    ]);

  const conversations = await fetchUnifiedInboxConversationsForDashboard(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    whatsappConnected,
    emailConnected,
    facebookConnected,
    instagramConnected,
  });

  const unread = conversations.filter(
    (c) => c.is_unread && c.unread_count > 0,
  );

  const channelOpts = {
    emailConnected,
    whatsappConnected,
    facebookConnected,
    instagramConnected,
  };

  for (const row of unread) {
    const platforms = platformsToMarkForConversation(row.contact_id, channelOpts);
    for (const platform of platforms) {
      const result = await markConversationReadServer(admin, {
        restaurantId: params.restaurantId,
        userId: params.userId,
        conversationKey: row.contact_id,
        platform,
      });
      if (result.error) {
        console.warn(
          "[gwada] mark-all conversations read",
          row.contact_id,
          platform,
          result.error,
        );
      }
    }
  }

  return { error: null };
}
