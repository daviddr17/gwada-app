import type { CountryReference } from "@/lib/constants/countries";
import { parseGuestPhone } from "@/lib/phone/guest-phone";
import { isBareWhatsAppPlaceholderName } from "@/lib/contact-messages/waha-chat-label";
import { digitsFromWhatsAppChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";

export type ContactCreateDraft = {
  firstName?: string;
  lastName?: string;
  company?: string;
  addressStreet?: string;
  addressPostalCode?: string;
  addressCity?: string;
  addressCountry?: string;
  notes?: string;
  phones?: Array<{ iso2: string; local: string; label?: string }>;
  emails?: Array<{ email: string; label?: string }>;
  linkExistingLexofficeId?: string | null;
};

export function draftFromWahaChat(params: {
  chatId: string;
  displayName: string;
  defaultCountryIso2: string;
  countries: CountryReference[];
  /** Aufgelöste Nummer (z. B. von WAHA LID-API), nicht die rohe @lid-ID. */
  resolvedPhoneForParse?: string | null;
}): ContactCreateDraft {
  const digitsFromChat = digitsFromWhatsAppChatId(params.chatId);
  const phoneRaw =
    params.resolvedPhoneForParse?.trim() ||
    (digitsFromChat ? `+${digitsFromChat}` : "");
  const phone = phoneRaw
    ? parseGuestPhone(phoneRaw, params.countries, params.defaultCountryIso2)
    : { iso2: params.defaultCountryIso2, local: "" };

  const name = params.displayName.trim();
  const genericWa = isBareWhatsAppPlaceholderName(name);
  let firstName = "";
  let lastName = "";
  if (!genericWa && name) {
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  }

  return {
    firstName: firstName || "Gast",
    lastName,
    phones: phone.local
      ? [{ iso2: phone.iso2, local: phone.local, label: "WhatsApp" }]
      : [],
  };
}
