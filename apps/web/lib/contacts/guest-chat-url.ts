import { getPublicSiteUrl } from "@/lib/public-env";

export const GUEST_CHAT_URL_PLACEHOLDERS = ["{id}", "{kontakt}"] as const;

/** Link ohne PIN — Zugangscode kommt separat per WhatsApp/E-Mail. */
export function defaultGuestChatUrl(contactId: string): string {
  const base = getPublicSiteUrl() ?? "https://new.gwada.app";
  const q = new URLSearchParams({ kontakt: contactId });
  return `${base}/nachrichten/kontakt?${q.toString()}`;
}

export function buildGuestChatUrl(
  template: string | null | undefined,
  contactId: string,
): string {
  const raw = template?.trim();
  if (!raw) return defaultGuestChatUrl(contactId);
  return raw
    .replaceAll("{id}", contactId)
    .replaceAll("{kontakt}", contactId)
    .replaceAll("{ID}", contactId)
    .replaceAll("{KONTAKT}", contactId)
    .replaceAll("{pin}", "")
    .replaceAll("{PIN}", "")
    .replace(/[?&]pin=(&|$)/g, "$1")
    .replace(/\?&/g, "?")
    .replace(/\?$/, "");
}

export function validateGuestChatUrlTemplate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2000) {
    return "Link-Vorlage ist zu lang (max. 2000 Zeichen).";
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return "Link muss mit http:// oder https:// beginnen.";
  }
  if (
    !trimmed.includes("{id}") &&
    !trimmed.includes("{kontakt}") &&
    !trimmed.includes("{ID}") &&
    !trimmed.includes("{KONTAKT}")
  ) {
    return "Vorlage muss {id} oder {kontakt} enthalten.";
  }
  if (trimmed.includes("{pin}") || trimmed.includes("{PIN}")) {
    return "PIN nicht in die URL legen — der Code wird separat versendet.";
  }
  return null;
}
