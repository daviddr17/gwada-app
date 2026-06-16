import {
  computeConversationUnread,
  conversationReadLookupKey,
  type ConversationReadRow,
  type ConversationUnreadInput,
} from "@/lib/contact-messages/conversation-read-state";
import { conversationChannelForRead } from "@/lib/contact-messages/unified-inbox-merge";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { fetchConversationReadsForUser } from "@/lib/supabase/contact-conversation-reads-db";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReadsByPlatform = {
  gwada: Map<string, ConversationReadRow>;
  whatsapp: Map<string, ConversationReadRow>;
  email: Map<string, ConversationReadRow>;
  facebook: Map<string, ConversationReadRow>;
  instagram: Map<string, ConversationReadRow>;
};

function readForPlatform(
  readsByPlatform: ReadsByPlatform,
  contactId: string,
  platform: ContactConversationPreview["platform"],
): ConversationReadRow | undefined {
  const map =
    platform === "whatsapp"
      ? readsByPlatform.whatsapp
      : platform === "email"
        ? readsByPlatform.email
        : platform === "facebook"
          ? readsByPlatform.facebook
          : platform === "instagram"
            ? readsByPlatform.instagram
            : readsByPlatform.gwada;
  return map.get(conversationReadLookupKey(contactId, platform));
}

function gwadaChannelConversationInput(
  c: ContactConversationPreview,
): ConversationUnreadInput {
  return {
    last_at: c.last_at,
    last_direction: c.last_direction,
  };
}

function enrichOneConversation(
  c: ContactConversationPreview,
  readsByPlatform: ReadsByPlatform,
): ContactConversationPreview {
  const readPlatform = conversationChannelForRead(c.contact_id);
  const read = readForPlatform(readsByPlatform, c.contact_id, readPlatform);

  const linked = isUuidRestaurantId(c.contact_id);
  if (linked) {
    const rWa = readsByPlatform.whatsapp.get(
      conversationReadLookupKey(c.contact_id, "whatsapp"),
    );
    const rEm = readsByPlatform.email.get(
      conversationReadLookupKey(c.contact_id, "email"),
    );
    const inboundChannel =
      c.last_inbound_platform ?? c.last_message_platform ?? "gwada";
    const gwadaRelevant = inboundChannel === "gwada";
    const unreadGwada = gwadaRelevant
      ? computeConversationUnread({
          read: readsByPlatform.gwada.get(
            conversationReadLookupKey(c.contact_id, "gwada"),
          ),
          conversation: gwadaChannelConversationInput(c),
        })
      : { unread_count: 0, is_unread: false };
    const unreadWa = computeConversationUnread({
      read: rWa,
      conversation: {
        last_at: c.last_at,
        last_direction: c.last_direction,
        external_unread_count: c.whatsapp_unread_count ?? null,
      },
    });
    const unreadEm = computeConversationUnread({
      read: rEm,
      conversation: {
        last_at: c.last_at,
        last_direction: c.last_direction,
        external_unread_count:
          c.email_unread_count !== undefined ? c.email_unread_count : null,
      },
    });
    const unread_count = Math.max(
      unreadGwada.unread_count,
      unreadWa.unread_count,
      unreadEm.unread_count,
    );
    /** IMAP/WAHA-Zähler sind maßgeblich — kein Gwada-Fallback mit is_unread bei count 0. */
    const is_unread = unread_count > 0;
    return { ...c, unread_count, is_unread };
  }

  const conversation: ConversationUnreadInput =
    readPlatform === "gwada"
      ? gwadaChannelConversationInput(c)
      : {
          last_at: c.last_at,
          last_direction: c.last_direction,
          external_unread_count: c.unread_count,
        };

  const { unread_count, is_unread } = computeConversationUnread({
    read,
    conversation,
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
  const [gwada, whatsapp, email, facebook, instagram] = await Promise.all([
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
    fetchConversationReadsForUser(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      platform: "facebook",
    }),
    fetchConversationReadsForUser(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      platform: "instagram",
    }),
  ]);

  return params.conversations.map((c) =>
    enrichOneConversation(c, { gwada, whatsapp, email, facebook, instagram }),
  );
}

export function enrichOneConversationWithReads(
  c: ContactConversationPreview,
  readsByPlatform: ReadsByPlatform,
): ContactConversationPreview {
  return enrichOneConversation(c, readsByPlatform);
}
