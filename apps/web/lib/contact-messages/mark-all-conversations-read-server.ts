import "server-only";

import { markConversationReadServer } from "@/lib/contact-messages/mark-conversation-read-server";
import { fetchUnifiedInboxConversationsForDashboard } from "@/lib/contact-messages/unified-inbox-server";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
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

/** Alle ungelesenen Konversationen im Postfach als gelesen markieren. */
export async function markAllConversationsReadForUserServer(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null }> {
  const [whatsappConnected, emailConnected, facebookConnected] =
    await Promise.all([
      isWhatsappConnected(),
      isEmailConnected(admin, params.restaurantId),
      isFacebookConnected(admin, params.restaurantId),
    ]);

  const conversations = await fetchUnifiedInboxConversationsForDashboard(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    whatsappConnected,
    emailConnected,
    facebookConnected,
  });

  const unread = conversations.filter(
    (c) => c.is_unread && c.unread_count > 0,
  );

  for (const row of unread) {
    const result = await markConversationReadServer(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      conversationKey: row.contact_id,
      platform: row.last_message_platform ?? "gwada",
    });
    if (result.error) return { error: result.error };
  }

  return { error: null };
}
