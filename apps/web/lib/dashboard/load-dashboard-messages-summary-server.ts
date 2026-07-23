import "server-only";

import { fetchMessagesUnreadSummary } from "@/lib/contact-messages/unread-summary-server";
import { resolveRestaurantImapCredentials } from "@/lib/contact-messages/email-inbox-service";
import { isMetaInboxConnected } from "@/lib/contact-messages/meta-inbox-auth-server";
import type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";

export async function loadDashboardMessagesSummaryServer(
  restaurantId: string,
  userId: string,
): Promise<MessagesUnreadSummary> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    throw new Error("server_misconfigured");
  }

  const [wahaConfig, imapCreds, facebookConnected, instagramConnected] =
    await Promise.all([
      getWahaServerConfigForRestaurantAdmin(restaurantId),
      resolveRestaurantImapCredentials(admin, restaurantId),
      isMetaInboxConnected(admin, restaurantId, "facebook"),
      isMetaInboxConnected(admin, restaurantId, "instagram"),
    ]);

  return fetchMessagesUnreadSummary(admin, {
    restaurantId,
    userId,
    whatsappConnected: Boolean(wahaConfig),
    emailConnected: Boolean(imapCreds),
    facebookConnected,
    instagramConnected,
    includeInboxConversations: false,
  });
}
