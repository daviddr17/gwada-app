import "server-only";

import { markConversationReadServer } from "@/lib/contact-messages/mark-conversation-read-server";
import {
  platformsToMarkForConversation,
  resolveInboxChannelConnections,
} from "@/lib/contact-messages/mark-unified-conversation-read-server";
import { fetchUnifiedInboxConversationsForDashboard } from "@/lib/contact-messages/unified-inbox-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Alle ungelesenen Konversationen im Postfach als gelesen markieren. */
export async function markAllConversationsReadForUserServer(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null }> {
  const channelConnections = await resolveInboxChannelConnections(
    admin,
    params.restaurantId,
  );

  const conversations = await fetchUnifiedInboxConversationsForDashboard(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    ...channelConnections,
  });

  const unread = conversations.filter(
    (c) => c.is_unread && c.unread_count > 0,
  );

  for (const row of unread) {
    const platforms = platformsToMarkForConversation(
      row.contact_id,
      channelConnections,
    );
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

export {
  markUnifiedInboxConversationReadServer,
  platformsToMarkForConversation,
  resolveInboxChannelConnections,
} from "@/lib/contact-messages/mark-unified-conversation-read-server";
