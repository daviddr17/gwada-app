import "server-only";

import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { upsertConversationRead } from "@/lib/supabase/contact-conversation-reads-db";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaMarkChatAsRead, wahaMarkChatAsUnread } from "@/lib/waha/waha-chat-read";
import { syncEmailThreadSeenOnImap } from "@/lib/contact-messages/email-inbox-service";
import { setEmailThreadExternalSeenInDb } from "@/lib/contacts/email-message-external-seen-db";
import { setMirrorThreadExternalSeenInDb } from "@/lib/contacts/message-thread-external-seen-db";
import { resolveWhatsappPhoneForContact } from "@/lib/contact-messages/resolve-whatsapp-phone";
import { wahaChatIdFromPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationReadMarkParams = {
  restaurantId: string;
  userId: string;
  conversationKey: string;
  platform: ContactMessagePlatform;
};

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

/** Nur DB (contact_conversation_reads + external_seen) — schnell für UI/API-Response. */
export async function markConversationReadDbServer(
  admin: SupabaseClient,
  params: ConversationReadMarkParams,
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

  if (params.platform === "email") {
    await setEmailThreadExternalSeenInDb(admin, {
      restaurantId: params.restaurantId,
      conversationKey: params.conversationKey,
      seen: true,
    });
  }

  if (params.platform === "whatsapp") {
    await setMirrorThreadExternalSeenInDb(admin, {
      restaurantId: params.restaurantId,
      conversationKey: params.conversationKey,
      platform: "whatsapp",
      seen: true,
    });
  }

  return { error: null };
}

/** WAHA / IMAP nachträglich — Fehler nur loggen, nicht an Client zurückgeben. */
export async function syncConversationReadExternalServer(
  admin: SupabaseClient,
  params: ConversationReadMarkParams,
): Promise<void> {
  if (params.platform === "whatsapp") {
    const chatId = await whatsappChatIdForConversation(admin, {
      restaurantId: params.restaurantId,
      conversationKey: params.conversationKey,
    });
    if (!chatId) return;

    const config = await getWahaServerConfigAdmin();
    if (!config) return;

    const waha = await wahaMarkChatAsRead({
      config,
      restaurantId: params.restaurantId,
      chatId,
    });
    if (!waha.ok) {
      console.warn(
        "[gwada] mark-read whatsapp",
        params.conversationKey,
        waha.error,
      );
    }
    return;
  }

  if (params.platform === "email") {
    const imap = await syncEmailThreadSeenOnImap(admin, {
      restaurantId: params.restaurantId,
      contactId: params.conversationKey,
      seen: true,
    });
    if (imap.error && imap.error !== "no_contact_email") {
      console.warn(
        "[gwada] mark-read imap",
        params.conversationKey,
        imap.error,
      );
    }
  }
}

/** Vollständig synchron (DB + extern) — nur wenn Response auf extern warten soll. */
export async function markConversationReadServer(
  admin: SupabaseClient,
  params: ConversationReadMarkParams,
): Promise<{ error: string | null }> {
  const db = await markConversationReadDbServer(admin, params);
  if (db.error) return db;
  await syncConversationReadExternalServer(admin, params);
  return { error: null };
}

export async function markConversationUnreadServer(
  admin: SupabaseClient,
  params: ConversationReadMarkParams,
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
    await setMirrorThreadExternalSeenInDb(admin, {
      restaurantId: params.restaurantId,
      conversationKey: params.conversationKey,
      platform: "whatsapp",
      seen: false,
    });
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
    await setEmailThreadExternalSeenInDb(admin, {
      restaurantId: params.restaurantId,
      conversationKey: params.conversationKey,
      seen: false,
    });
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
