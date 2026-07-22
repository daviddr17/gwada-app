/** Max. Länge für Zusatztext an Gast-Benachrichtigungen (WhatsApp/E-Mail). */
export const GUEST_NOTIFY_MESSAGE_MAX_CHARS = 1000;

export type ReservationDispatchOptions = {
  /** Optionaler Freitext — wird als „Nachricht:“ an die Vorlage gehängt. */
  guestNotifyMessage?: string | null;
};

/**
 * Hängt optionalen Mitarbeiter-Freitext an die Vorlagen-Nachricht an.
 * Ohne Absender — nur „Nachricht:“ + Text.
 */
export function appendGuestNotifyMessage(
  templateText: string,
  extra: string | null | undefined,
): string {
  const msg = normalizeGuestNotifyMessage(extra);
  if (!msg) return templateText;
  const base = templateText.replace(/\s+$/u, "");
  return `${base}\n\nNachricht:\n${msg}`;
}

export function normalizeGuestNotifyMessage(
  extra: string | null | undefined,
): string {
  if (typeof extra !== "string") return "";
  const trimmed = extra.replace(/\u0000/g, "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= GUEST_NOTIFY_MESSAGE_MAX_CHARS) return trimmed;
  return trimmed.slice(0, GUEST_NOTIFY_MESSAGE_MAX_CHARS).trimEnd();
}
