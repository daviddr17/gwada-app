/** Pseudo-Kontakt-ID für WAHA-Chats ohne verknüpften Kontakt: `waha:491701234567@c.us`. */

export function isWahaPseudoContactId(contactId: string): boolean {
  return contactId.startsWith("waha:");
}

export function wahaChatIdFromPseudoContactId(
  contactId: string,
): string | null {
  if (!isWahaPseudoContactId(contactId)) return null;
  const chatId = contactId.slice(5).trim();
  return chatId.includes("@") ? chatId : null;
}

export function wahaPseudoContactIdFromChatId(chatId: string): string {
  return `waha:${chatId}`;
}

const WHATSAPP_PHONE_CHAT_SUFFIXES = ["@c.us", "@s.whatsapp.net"] as const;

function isWhatsAppPhoneJid(id: string): boolean {
  return WHATSAPP_PHONE_CHAT_SUFFIXES.some((suffix) => id.endsWith(suffix));
}

export function digitsFromWhatsAppChatId(chatId: string): string | null {
  const id = chatId.trim().toLowerCase();
  if (id.endsWith("@lid") || id.includes("@lid")) {
    return null;
  }
  if (id.includes("@") && !isWhatsAppPhoneJid(id)) {
    return null;
  }
  const beforeAt = chatId.trim().split("@")[0] ?? "";
  const digits = beforeAt.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

export { isWahaLidChatId } from "@/lib/waha/waha-lids";
