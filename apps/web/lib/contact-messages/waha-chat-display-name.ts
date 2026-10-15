import "server-only";

import {
  extractPhoneDigitsFromWahaChat,
  extractPhoneDigitsFromWahaOverview,
  extractWahaBusinessDisplayName,
  formatDigitsAsWhatsAppPhone,
  isBareWhatsAppPlaceholderName,
  pickWahaChatReadableTitle,
  type WahaInboxLookupMaps,
} from "@/lib/contact-messages/waha-chat-label";
import { resolveWahaChatPhone } from "@/lib/contact-messages/resolve-waha-chat-phone";
import type { WahaServerConfig } from "@/lib/waha/waha-config";
import {
  wahaGetChatMessages,
  wahaGetChatsOverview,
  type WahaChatOverviewItem,
} from "@/lib/waha/waha-inbox";
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

function businessNameFromMessages(
  messages: Array<{ _data?: Record<string, unknown> | null }>,
): string | null {
  for (const message of messages) {
    const data =
      message._data && typeof message._data === "object"
        ? message._data
        : null;
    const name = extractWahaBusinessDisplayName(data);
    if (name) return name;
  }
  return null;
}

async function loadOverviewChatForDisplayName(params: {
  config: WahaServerConfig;
  restaurantId: string;
  chatId: string;
}): Promise<WahaChatOverviewItem | null> {
  const overview = await wahaGetChatsOverview({
    config: params.config,
    restaurantId: params.restaurantId,
    limit: 5,
    ids: [params.chatId],
  });
  if (!overview.ok || overview.data.length === 0) return null;
  const exact = overview.data.find(
    (chat) =>
      (chat.id ?? "").trim() === params.chatId ||
      (chat._chat &&
        typeof chat._chat === "object" &&
        "id" in chat._chat &&
        String((chat._chat as { id?: string }).id ?? "").trim() ===
          params.chatId),
  );
  return exact ?? overview.data[0] ?? null;
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

  let overviewChat = params.overviewChat ?? null;
  if (!overviewChat) {
    overviewChat = await loadOverviewChatForDisplayName({
      config: params.config,
      restaurantId: params.restaurantId,
      chatId: params.chatId,
    });
  }

  const readableTitle = pickWahaChatReadableTitle({
    overviewName: params.overviewName ?? overviewChat?.name,
    overviewChat,
    wahaContact: contact,
  });
  if (readableTitle) return readableTitle;

  const fromMessagesApi = await wahaGetChatMessages({
    config: params.config,
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    limit: 20,
    downloadMedia: false,
  });
  if (fromMessagesApi.ok) {
    const fromHistory = businessNameFromMessages(fromMessagesApi.data);
    if (fromHistory) return fromHistory;
  }

  const digits =
    (overviewChat
      ? extractPhoneDigitsFromWahaOverview(overviewChat, params.lookupMaps)
      : null) ??
    extractPhoneDigitsFromWahaChat(
      params.chatId,
      params.overviewName ?? overviewChat?.name,
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
