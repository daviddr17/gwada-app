import "server-only";

import {
  markConversationReadDbServer,
  syncConversationReadExternalServer,
  type ConversationReadMarkParams,
} from "@/lib/contact-messages/mark-conversation-read-server";
import {
  platformsToMarkForConversation,
  resolveInboxChannelConnections,
} from "@/lib/contact-messages/mark-unified-conversation-read-server";
import { fetchUnifiedInboxConversationsForDashboard } from "@/lib/contact-messages/unified-inbox-server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Alle ungelesenen Konversationen: nur DB (schnell). */
export async function markAllConversationsReadDbForUserServer(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null; marks: ConversationReadMarkParams[] }> {
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

  const marks: ConversationReadMarkParams[] = unread.flatMap((row) =>
    platformsToMarkForConversation(row.contact_id, channelConnections).map(
      (platform) => ({
        restaurantId: params.restaurantId,
        userId: params.userId,
        conversationKey: row.contact_id,
        platform,
      }),
    ),
  );

  const results = await Promise.all(
    marks.map((mark) => markConversationReadDbServer(admin, mark)),
  );
  const firstError = results.find((r) => r.error)?.error ?? null;
  return { error: firstError, marks };
}

export async function syncAllConversationsReadExternalServer(
  admin: SupabaseClient,
  marks: ConversationReadMarkParams[],
): Promise<void> {
  await Promise.all(
    marks.map((mark) => syncConversationReadExternalServer(admin, mark)),
  );
}

/** Alle ungelesenen Konversationen im Postfach als gelesen markieren. */
export async function markAllConversationsReadForUserServer(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ error: string | null }> {
  const { error, marks } = await markAllConversationsReadDbForUserServer(
    admin,
    params,
  );
  if (error) return { error };
  await syncAllConversationsReadExternalServer(admin, marks);
  return { error: null };
}

export {
  markUnifiedInboxConversationReadServer,
  markUnifiedInboxConversationReadDbServer,
  syncUnifiedInboxConversationReadExternalServer,
  platformsToMarkForConversation,
  resolveInboxChannelConnections,
} from "@/lib/contact-messages/mark-unified-conversation-read-server";
