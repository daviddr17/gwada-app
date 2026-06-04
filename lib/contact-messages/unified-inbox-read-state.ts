import {
  computeConversationUnread,
  conversationReadLookupKey,
  type ConversationReadRow,
} from "@/lib/contact-messages/conversation-read-state";
import { conversationChannelForRead } from "@/lib/contact-messages/unified-inbox-merge";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { fetchConversationReadsForUser } from "@/lib/supabase/contact-conversation-reads-db";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

function enrichOneConversation(
  c: ContactConversationPreview,
  readsByPlatform: {
    gwada: Map<string, ConversationReadRow>;
    whatsapp: Map<string, ConversationReadRow>;
    email: Map<string, ConversationReadRow>;
  },
): ContactConversationPreview {
  const readPlatform = conversationChannelForRead(c.contact_id);
  const read =
    readPlatform === "whatsapp"
      ? readsByPlatform.whatsapp.get(
          conversationReadLookupKey(c.contact_id, "whatsapp"),
        )
      : readPlatform === "email"
        ? readsByPlatform.email.get(
            conversationReadLookupKey(c.contact_id, "email"),
          )
        : readsByPlatform.gwada.get(
            conversationReadLookupKey(c.contact_id, "gwada"),
          );

  const linked = isUuidRestaurantId(c.contact_id);
  if (linked) {
    const rWa = readsByPlatform.whatsapp.get(
      conversationReadLookupKey(c.contact_id, "whatsapp"),
    );
    const rEm = readsByPlatform.email.get(
      conversationReadLookupKey(c.contact_id, "email"),
    );
    const unreadGwada = computeConversationUnread({
      read: readsByPlatform.gwada.get(
        conversationReadLookupKey(c.contact_id, "gwada"),
      ),
      conversation: {
        last_at: c.last_at,
        last_direction: c.last_direction,
        inbound_count: c.inbound_since_preview,
      },
    });
    const unreadWa = computeConversationUnread({
      read: rWa,
      conversation: {
        last_at: c.last_at,
        last_direction: c.last_direction,
        external_unread_count:
          c.last_message_platform === "whatsapp" ? c.unread_count : null,
      },
    });
    const unreadEm = computeConversationUnread({
      read: rEm,
      conversation: {
        last_at: c.last_at,
        last_direction: c.last_direction,
        external_unread_count:
          c.last_message_platform === "email" ? c.unread_count : null,
      },
    });
    const unread_count = Math.max(
      unreadGwada.unread_count,
      unreadWa.unread_count,
      unreadEm.unread_count,
      c.unread_count,
    );
    const is_unread =
      unreadGwada.is_unread ||
      unreadWa.is_unread ||
      unreadEm.is_unread ||
      c.is_unread;
    return { ...c, unread_count, is_unread };
  }

  const { unread_count, is_unread } = computeConversationUnread({
    read,
    conversation: {
      last_at: c.last_at,
      last_direction: c.last_direction,
      inbound_count: c.inbound_since_preview,
      external_unread_count:
        readPlatform === "whatsapp" || readPlatform === "email"
          ? c.unread_count
          : null,
    },
  });
  return { ...c, unread_count, is_unread };
}

export async function enrichUnifiedInboxReadStateServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversations: ContactConversationPreview[];
  },
): Promise<ContactConversationPreview[]> {
  const [gwada, whatsapp, email] = await Promise.all([
    fetchConversationReadsForUser(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      platform: "gwada",
    }),
    fetchConversationReadsForUser(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      platform: "whatsapp",
    }),
    fetchConversationReadsForUser(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      platform: "email",
    }),
  ]);

  return params.conversations.map((c) =>
    enrichOneConversation(c, { gwada, whatsapp, email }),
  );
}

export function enrichOneConversationWithReads(
  c: ContactConversationPreview,
  readsByPlatform: {
    gwada: Map<string, ConversationReadRow>;
    whatsapp: Map<string, ConversationReadRow>;
    email: Map<string, ConversationReadRow>;
  },
): ContactConversationPreview {
  return enrichOneConversation(c, readsByPlatform);
}
