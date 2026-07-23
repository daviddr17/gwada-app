import "server-only";

import { resolveWahaChatDisplayName } from "@/lib/contact-messages/waha-chat-display-name";
import {
  formatDigitsAsWhatsAppPhone,
  pickReadableName,
  sanitizeConversationLabelForStorage,
} from "@/lib/contact-messages/waha-chat-label";
import { resolveWahaChatPhone } from "@/lib/contact-messages/resolve-waha-chat-phone";
import {
  wahaPseudoContactIdFromChatId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { normalizeContactPhone } from "@/lib/contacts/normalize-contact-identity";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { isWahaLidChatId } from "@/lib/waha/waha-lids";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WahaInboundIdentity = {
  sourceChatId: string;
  storageChatId: string;
  pseudoContactId: string;
  displayLabel: string;
  phoneDisplay: string | null;
  phoneNormalized: string | null;
  isLidChat: boolean;
};

function phoneDisplayFromParse(phoneForParse: string, iso = "DE"): string | null {
  const digits = phoneForParse.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return formatDigitsAsWhatsAppPhone(digits, iso);
}

/** WAHA-Chat (inkl. @lid): Anzeigename, Telefon, Pseudo-Thread-Schlüssel. */
export async function resolveWahaInboundIdentity(
  _admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId: string;
    pushName?: string | null;
    defaultCountryIso2?: string;
  },
): Promise<WahaInboundIdentity> {
  const iso = params.defaultCountryIso2 ?? "DE";
  const sourceChatId = params.chatId.trim();
  const isLidChat = isWahaLidChatId(sourceChatId);

  const phoneRes = await resolveWahaChatPhone({
    restaurantId: params.restaurantId,
    chatId: sourceChatId,
  });

  const storageChatId = phoneRes.phoneChatId ?? sourceChatId;
  const phoneNormalized = phoneRes.phoneForParse
    ? normalizeContactPhone(phoneRes.phoneForParse.replace(/\D/g, ""))
    : null;
  const phoneDisplay = phoneRes.phoneForParse
    ? phoneDisplayFromParse(phoneRes.phoneForParse, iso)
    : null;

  const pushReadable = pickReadableName(params.pushName);
  let displayLabel = pushReadable;

  if (!displayLabel) {
    const config = await getWahaServerConfigForRestaurantAdmin(
      params.restaurantId,
    );
    if (config) {
      const resolved = await resolveWahaChatDisplayName({
        config,
        restaurantId: params.restaurantId,
        chatId: sourceChatId,
        defaultCountryIso2: iso,
      });
      displayLabel = pickReadableName(resolved);
    }
  }

  if (!displayLabel) {
    displayLabel = phoneDisplay ?? "WhatsApp";
  }

  return {
    sourceChatId,
    storageChatId,
    pseudoContactId: wahaPseudoContactIdFromChatId(storageChatId),
    displayLabel,
    phoneDisplay,
    phoneNormalized,
    isLidChat,
  };
}

export function conversationLabelForWahaInboundIdentity(
  identity: WahaInboundIdentity,
): string | null {
  return sanitizeConversationLabelForStorage(identity.displayLabel);
}
