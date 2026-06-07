import "server-only";

import { digitsFromWhatsAppChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import {
  isWahaLidChatId,
  isWahaPhoneChatId,
  wahaGetContactByChatId,
  wahaResolveLidToPhoneChatId,
} from "@/lib/waha/waha-lids";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";

export type ResolvedWahaChatPhone = {
  /** E.164-artig mit + für parseGuestPhone, oder null wenn unbekannt. */
  phoneForParse: string | null;
  phoneChatId: string | null;
  isLidChat: boolean;
  lidUnresolved: boolean;
};

function phoneChatIdFromContactNumber(number: string | null | undefined): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return guestPhoneToWhatsAppChatId(digits);
}

/**
 * Löst WAHA-Chat-ID zu einer echten Telefonnummer auf.
 * @c.us → direkt; @lid → WAHA LID-API (+ optional Kontakt-API).
 */
export async function resolveWahaChatPhone(params: {
  restaurantId: string;
  chatId: string;
}): Promise<ResolvedWahaChatPhone & { error: string | null }> {
  const chatId = params.chatId.trim();
  if (!chatId) {
    return {
      phoneForParse: null,
      phoneChatId: null,
      isLidChat: false,
      lidUnresolved: false,
      error: "empty_chat_id",
    };
  }

  if (isWahaPhoneChatId(chatId)) {
    const digits = digitsFromWhatsAppChatId(chatId);
    return {
      phoneForParse: digits ? `+${digits}` : null,
      phoneChatId: digits ? guestPhoneToWhatsAppChatId(digits) : null,
      isLidChat: false,
      lidUnresolved: false,
      error: null,
    };
  }

  if (!isWahaLidChatId(chatId)) {
    return {
      phoneForParse: null,
      phoneChatId: null,
      isLidChat: false,
      lidUnresolved: false,
      error: "unknown_chat_id_format",
    };
  }

  const config = await getWahaServerConfigAdmin();
  if (!config) {
    return {
      phoneForParse: null,
      phoneChatId: null,
      isLidChat: true,
      lidUnresolved: true,
      error: "waha_not_configured",
    };
  }

  const { pn, error: lidErr } = await wahaResolveLidToPhoneChatId({
    config,
    restaurantId: params.restaurantId,
    lidChatId: chatId,
  });

  let phoneChatId = pn;

  if (!phoneChatId) {
    const { data: contact } = await wahaGetContactByChatId({
      config,
      restaurantId: params.restaurantId,
      contactId: chatId,
    });
    phoneChatId =
      phoneChatIdFromContactNumber(contact?.number) ??
      (contact?.id && isWahaPhoneChatId(contact.id) ? contact.id : null);
  }

  if (!phoneChatId) {
    return {
      phoneForParse: null,
      phoneChatId: null,
      isLidChat: true,
      lidUnresolved: true,
      error: lidErr,
    };
  }

  const digits = digitsFromWhatsAppChatId(phoneChatId);
  return {
    phoneForParse: digits ? `+${digits}` : null,
    phoneChatId,
    isLidChat: true,
    lidUnresolved: false,
    error: null,
  };
}
