import "server-only";

import {
  extractPhoneDigitsFromWahaChat,
  extractPhoneDigitsFromWahaOverview,
  formatDigitsAsWhatsAppPhone,
  isBareWhatsAppPlaceholderName,
  pickWahaChatReadableTitle,
  type WahaInboxLookupMaps,
} from "@/lib/contact-messages/waha-chat-label";
import { resolveWahaChatPhone } from "@/lib/contact-messages/resolve-waha-chat-phone";
import type { WahaServerConfig } from "@/lib/waha/waha-config";
import type { WahaChatOverviewItem } from "@/lib/waha/waha-inbox";
import {
  wahaGetContactByChatId,
  type WahaContactInfo,
} from "@/lib/waha/waha-lids";

export {
  displayNameFromChatOverview,
  formatDigitsAsWhatsAppPhone,
  isGenericWhatsAppFallbackName,
  isPhoneLikeDisplayName,
  pickWahaChatReadableTitle,
} from "@/lib/contact-messages/waha-chat-label";

function formatContactNumber(
  number: string | null | undefined,
  defaultCountryIso2: string,
): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return formatDigitsAsWhatsAppPhone(digits, defaultCountryIso2);
}

export async function resolveWahaChatDisplayName(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
  overviewName?: string | null;
  overviewChat?: WahaChatOverviewItem | null;
  defaultCountryIso2?: string;
  lookupMaps?: WahaInboxLookupMaps;
  wahaContact?: WahaContactInfo | null;
}): Promise<string> {
  const iso = params.defaultCountryIso2 ?? "DE";

  const contact =
    params.wahaContact ??
    (
      await wahaGetContactByChatId({
        config: params.config,
        restaurantId: params.restaurantId,
        contactId: params.chatId,
      })
    ).data;

  const readableTitle = pickWahaChatReadableTitle({
    overviewName: params.overviewName,
    overviewChat: params.overviewChat,
    wahaContact: contact,
  });
  if (readableTitle) return readableTitle;

  const digits =
    (params.overviewChat
      ? extractPhoneDigitsFromWahaOverview(params.overviewChat, params.lookupMaps)
      : null) ??
    extractPhoneDigitsFromWahaChat(
      params.chatId,
      params.overviewName ?? params.overviewChat?.name,
    );
  if (digits) {
    const fromDigits = formatDigitsAsWhatsAppPhone(digits, iso);
    if (!isBareWhatsAppPlaceholderName(fromDigits)) return fromDigits;
  }

  const fromNumber = formatContactNumber(contact?.number, iso);
  if (fromNumber) return fromNumber;

  const phone = await resolveWahaChatPhone({
    restaurantId: params.restaurantId,
    chatId: params.chatId,
  });
  if (phone.phoneForParse) {
    const fromResolve = formatContactNumber(phone.phoneForParse, iso);
    if (fromResolve) return fromResolve;
  }

  const fromChatIdDigits = extractPhoneDigitsFromWahaChat(params.chatId);
  if (fromChatIdDigits) {
    const fromChatId = formatDigitsAsWhatsAppPhone(fromChatIdDigits, iso);
    if (!isBareWhatsAppPlaceholderName(fromChatId)) return fromChatId;
  }

  return "WhatsApp";
}
