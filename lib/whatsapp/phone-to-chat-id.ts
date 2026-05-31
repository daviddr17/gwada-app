/** Gast-Telefon (+49 …) → WAHA chatId `491701234567@c.us`. */
export function guestPhoneToWhatsAppChatId(
  guestPhone: string | null | undefined,
): string | null {
  const digits = (guestPhone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `${digits}@c.us`;
}
