import {
  extractPhoneDigitsFromWahaChat,
  formatDigitsAsWhatsAppPhone,
  isBareWhatsAppPlaceholderName,
  isWhatsAppJidOrRawNumberLabel,
} from "@/lib/contact-messages/waha-chat-label";
import {
  digitsFromWhatsAppChatId,
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { normalizeContactPhone } from "@/lib/contacts/normalize-contact-identity";
import type { ContactListRow } from "@/lib/supabase/contacts-db";

/** Internationales Format (+49 …), nie „WhatsApp“ als Platzhalter. */
export function formatPhoneDigitsInternational(
  digits: string,
  defaultIso2 = "DE",
): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length < 8) return null;
  const formatted = formatDigitsAsWhatsAppPhone(d, defaultIso2);
  if (isBareWhatsAppPlaceholderName(formatted)) return null;
  const t = formatted.trim();
  if (t.startsWith("+")) return t;
  return `+${d}`;
}

/** Nummer aus WAHA-Chat-ID / JID (z. B. `491…@c.us`). */
export function phoneSubtitleFromChatId(
  chatId: string,
  defaultIso2 = "DE",
): string | null {
  const digits =
    extractPhoneDigitsFromWahaChat(chatId) ?? digitsFromWhatsAppChatId(chatId);
  if (!digits) return null;
  return formatPhoneDigitsInternational(digits, defaultIso2);
}

export function phoneSubtitleFromContactRow(
  contact: ContactListRow,
  defaultIso2 = "DE",
): string | null {
  const phones = [...contact.contact_phones].sort(
    (a, b) =>
      Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );

  for (const p of phones) {
    const display = p.phone_display?.trim();
    if (!display) continue;

    const normalized = normalizeContactPhone(display);
    const digits = (normalized ?? display).replace(/\D/g, "");
    const formatted = formatPhoneDigitsInternational(digits, defaultIso2);
    if (formatted) return formatted;
  }

  return null;
}

function subtitleFromConversationName(
  name: string,
  defaultIso2: string,
): string | null {
  const t = name.trim();
  if (!t || isBareWhatsAppPlaceholderName(t)) return null;
  if (t.startsWith("+") && !isBareWhatsAppPlaceholderName(t)) return t;
  if (isWhatsAppJidOrRawNumberLabel(t)) {
    return phoneSubtitleFromChatId(t, defaultIso2);
  }
  return null;
}

export async function resolveWhatsAppThreadPhoneSubtitle(params: {
  contactId: string;
  defaultCountryIso2?: string;
  conversationDisplayName?: string | null;
  contact?: ContactListRow | null;
  fetchResolvedPhone?: (args: {
    restaurantId: string;
    chatId: string;
  }) => Promise<{ phoneForParse?: string | null }>;
  restaurantId?: string;
}): Promise<string | null> {
  const iso = params.defaultCountryIso2 ?? "DE";
  const displayName = params.conversationDisplayName?.trim() ?? "";

  const fromName = displayName
    ? subtitleFromConversationName(displayName, iso)
    : null;
  if (fromName) return fromName;

  if (isWahaPseudoContactId(params.contactId)) {
    const chatId = wahaChatIdFromPseudoContactId(params.contactId);
    if (!chatId) return null;

    const fromChat = phoneSubtitleFromChatId(chatId, iso);
    if (fromChat) return fromChat;

    if (params.fetchResolvedPhone && params.restaurantId) {
      const { phoneForParse } = await params.fetchResolvedPhone({
        restaurantId: params.restaurantId,
        chatId,
      });
      const digits = (phoneForParse ?? "").replace(/\D/g, "");
      if (digits.length >= 8) {
        return formatPhoneDigitsInternational(digits, iso);
      }
    }
    return null;
  }

  if (params.contact) {
    return phoneSubtitleFromContactRow(params.contact, iso);
  }

  return null;
}
