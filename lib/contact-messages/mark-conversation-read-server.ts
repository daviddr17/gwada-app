import "server-only";

import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { upsertConversationRead } from "@/lib/supabase/contact-conversation-reads-db";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaMarkChatAsRead, wahaMarkChatAsUnread } from "@/lib/waha/waha-chat-read";
import { syncEmailThreadSeenOnImap } from "@/lib/contact-messages/email-inbox-service";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import { wahaChatIdFromPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import type { SupabaseClient } from "@supabase/supabase-js";

async function whatsappChatIdForConversation(
  admin: SupabaseClient,
  params: { restaurantId: string; conversationKey: string },
): Promise<string | null> {
  const fromPseudo = wahaChatIdFromPseudoContactId(params.conversationKey);
  if (fromPseudo) return fromPseudo;
  const phone = await resolveWhatsappPhoneForContact(admin, {
    restaurantId: params.restaurantId,
    contactId: params.conversationKey,
    reservationId: null,
  });
  return phone ? guestPhoneToWhatsAppChatId(phone) : null;
}

export async function markConversationReadServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    platform: ContactMessagePlatform;
  },
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await upsertConversationRead(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    conversationKey: params.conversationKey,
    platform: params.platform,
    lastReadAt: now,
    markedUnreadAt: null,
  });
  if (error) return { error };

  if (params.platform === "whatsapp") {
    const chatId = await whatsappChatIdForConversation(admin, {
      restaurantId: params.restaurantId,
      conversationKey: params.conversationKey,
    });
    if (chatId) {
      const config = await getWahaServerConfigAdmin();
      if (config) {
        const waha = await wahaMarkChatAsRead({
          config,
          restaurantId: params.restaurantId,
          chatId,
        });
        if (!waha.ok) return { error: waha.error };
      }
    }
  }

  if (params.platform === "email") {
    const imap = await syncEmailThreadSeenOnImap(admin, {
      restaurantId: params.restaurantId,
      contactId: params.conversationKey,
      seen: true,
    });
    if (imap.error && imap.error !== "no_contact_email") {
      return { error: imap.error };
    }
  }

  return { error: null };
}

export async function markConversationUnreadServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    platform: ContactMessagePlatform;
  },
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();
  const { error } = await upsertConversationRead(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    conversationKey: params.conversationKey,
    platform: params.platform,
    markedUnreadAt: now,
  });
  if (error) return { error };

  if (params.platform === "whatsapp") {
    const chatId = await whatsappChatIdForConversation(admin, {
      restaurantId: params.restaurantId,
      conversationKey: params.conversationKey,
    });
    if (chatId) {
      const config = await getWahaServerConfigAdmin();
      if (config) {
        const waha = await wahaMarkChatAsUnread({
          config,
          restaurantId: params.restaurantId,
          chatId,
        });
        if (!waha.ok) return { error: waha.error };
      }
    }
  }

  if (params.platform === "email") {
    const imap = await syncEmailThreadSeenOnImap(admin, {
      restaurantId: params.restaurantId,
      contactId: params.conversationKey,
      seen: false,
    });
    if (imap.error && imap.error !== "no_contact_email") {
      return { error: imap.error };
    }
  }

  return { error: null };
}
