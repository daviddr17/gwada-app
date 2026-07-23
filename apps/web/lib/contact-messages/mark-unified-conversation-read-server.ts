import "server-only";

import {
  markConversationReadDbServer,
  syncConversationReadExternalServer,
  type ConversationReadMarkParams,
} from "@/lib/contact-messages/mark-conversation-read-server";
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
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
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
      getWahaServerConfigForRestaurantAdmin(restaurantId).then(Boolean),
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

function readMarkParamsForConversation(
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    channelConnections?: InboxChannelConnectionFlags;
  },
  channelConnections: InboxChannelConnectionFlags,
): ConversationReadMarkParams[] {
  const platforms = isLinkedContactId(params.conversationKey)
    ? platformsToMarkForConversation(params.conversationKey, channelConnections)
    : [conversationChannelForRead(params.conversationKey)];

  return platforms.map((platform) => ({
    restaurantId: params.restaurantId,
    userId: params.userId,
    conversationKey: params.conversationKey,
    platform,
  }));
}

/** Verknüpfte Kontakte: alle relevanten Kanäle in DB als gelesen (parallel). */
export async function markUnifiedInboxConversationReadDbServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    channelConnections?: InboxChannelConnectionFlags;
  },
): Promise<{ error: string | null; marks: ConversationReadMarkParams[] }> {
  const channelConnections =
    params.channelConnections ??
    (await resolveInboxChannelConnections(admin, params.restaurantId));

  const marks = readMarkParamsForConversation(params, channelConnections);
  const results = await Promise.all(
    marks.map((mark) => markConversationReadDbServer(admin, mark)),
  );
  const firstError = results.find((r) => r.error)?.error ?? null;
  return { error: firstError, marks };
}

export async function syncUnifiedInboxConversationReadExternalServer(
  admin: SupabaseClient,
  marks: ConversationReadMarkParams[],
): Promise<void> {
  await Promise.all(
    marks.map((mark) => syncConversationReadExternalServer(admin, mark)),
  );
}

/** @deprecated Prefer db + after(external) for API routes. */
export async function markUnifiedInboxConversationReadServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    channelConnections?: InboxChannelConnectionFlags;
  },
): Promise<{ error: string | null }> {
  const { error, marks } = await markUnifiedInboxConversationReadDbServer(
    admin,
    params,
  );
  if (error) return { error };
  await syncUnifiedInboxConversationReadExternalServer(admin, marks);
  return { error: null };
}
