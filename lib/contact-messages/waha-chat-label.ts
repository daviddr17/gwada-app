import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import { formatGuestPhone, parseGuestPhone } from "@/lib/phone/guest-phone";
import {
  digitsFromWhatsAppChatId,
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import type { WahaChatOverviewItem } from "@/lib/waha/waha-inbox";
import {
  isWahaPhoneChatId,
  type WahaContactInfo,
} from "@/lib/waha/waha-lids";

const GENERIC_WA_NAME = /^WhatsApp\s+\d{2,6}$/i;

export function isGenericWhatsAppFallbackName(name: string): boolean {
  return GENERIC_WA_NAME.test(name.trim());
}

/** Platzhalter von WAHA/App — kein Anzeigename. */
export function isBareWhatsAppPlaceholderName(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (/^whatsapp$/i.test(t)) return true;
  return isGenericWhatsAppFallbackName(t);
}

/** WhatsApp-JID oder Rohnummer — kein Pushname (z. B. `49151…@c.us`). */
export function isWhatsAppJidOrRawNumberLabel(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (/@(c\.us|lid|s\.whatsapp\.net)$/i.test(t)) return true;
  if (/^\+?[\d\s().-]+$/.test(t)) return true;
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length === t.replace(/[\s+()-]/g, "").length) {
    return true;
  }
  return false;
}

/** @deprecated Alias — gleiche Semantik wie {@link isWhatsAppJidOrRawNumberLabel}. */
export function isPhoneLikeDisplayName(name: string): boolean {
  return isWhatsAppJidOrRawNumberLabel(name);
}

function digitsFromRawPhoneValue(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const fromJid = digitsFromWhatsAppChatId(t);
  if (fromJid) return fromJid;
  if (t.includes("@")) return null;
  const digits = t.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

function pushCandidate(candidates: string[], value: string | null | undefined) {
  const t = value?.trim();
  if (!t) return;
  if (!candidates.includes(t)) candidates.push(t);
}

/** Ziffern aus Chat-ID, `name`-Feld oder JID-String. */
export function extractPhoneDigitsFromWahaChat(
  chatId: string,
  name?: string | null,
): string | null {
  for (const c of [chatId, name ?? ""]) {
    const d = digitsFromRawPhoneValue(c);
    if (d) return d;
  }
  return null;
}

export type WahaInboxLookupMaps = {
  lidToPn?: ReadonlyMap<string, string>;
  contactByChatId?: ReadonlyMap<string, WahaContactInfo>;
};

/** Telefon aus Overview, LID-Map, Kontakt-Store und letzter Nachricht. */
export function extractPhoneDigitsFromWahaOverview(
  chat: WahaChatOverviewItem,
  maps?: WahaInboxLookupMaps,
): string | null {
  const candidates: string[] = [];
  const overviewId = (chat.id ?? "").trim();

  pushCandidate(candidates, overviewId);
  if (maps?.lidToPn && overviewId) {
    pushCandidate(
      candidates,
      maps.lidToPn.get(overviewId) ?? maps.lidToPn.get(overviewId.toLowerCase()),
    );
  }
  if (maps?.contactByChatId && overviewId) {
    const contact =
      maps.contactByChatId.get(overviewId) ??
      maps.contactByChatId.get(overviewId.toLowerCase());
    pushCandidate(candidates, contact?.number ?? null);
    pushCandidate(candidates, contact?.id ?? null);
  }

  pushCandidate(candidates, chat.name);
  const inner =
    chat._chat && typeof chat._chat === "object" && !Array.isArray(chat._chat)
      ? (chat._chat as Record<string, unknown>)
      : null;
  if (inner) {
    for (const key of ["id", "user", "wid", "phoneNumber", "jid"]) {
      const v = inner[key];
      if (typeof v === "string") pushCandidate(candidates, v);
    }
    const nested = inner.contact ?? inner.userObj;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const n = nested as Record<string, unknown>;
      for (const key of ["id", "user", "wid"]) {
        const v = n[key];
        if (typeof v === "string") pushCandidate(candidates, v);
      }
    }
  }

  const lm = chat.lastMessage;
  if (lm?.from) pushCandidate(candidates, lm.from);
  if (lm?.to) pushCandidate(candidates, lm.to);
  if (lm?.fromMe && lm.to) {
    pushCandidate(candidates, lm.to);
  } else if (!lm?.fromMe && lm?.from) {
    pushCandidate(candidates, lm.from);
  }

  for (const c of candidates) {
    const d = digitsFromRawPhoneValue(c);
    if (d) return d;
  }
  return null;
}

/** Bevorzugt @c.us-ID, wenn Overview nur @lid liefert. */
export function resolveWahaOverviewChatId(
  chat: WahaChatOverviewItem,
  maps?: WahaInboxLookupMaps,
): string {
  const overviewId = (chat.id ?? chat._chat?.id ?? "").trim();
  if (overviewId && isWahaPhoneChatId(overviewId)) return overviewId;

  if (overviewId && maps?.lidToPn) {
    const pn =
      maps.lidToPn.get(overviewId) ??
      maps.lidToPn.get(overviewId.toLowerCase());
    if (pn && isWahaPhoneChatId(pn)) return pn;
  }

  const inner =
    chat._chat && typeof chat._chat === "object" && !Array.isArray(chat._chat)
      ? (chat._chat as Record<string, unknown>)
      : null;
  if (inner) {
    for (const key of ["id", "user", "wid"]) {
      const v = inner[key];
      if (typeof v === "string" && isWahaPhoneChatId(v)) return v;
    }
  }

  const lm = chat.lastMessage;
  if (lm?.from && isWahaPhoneChatId(lm.from)) return lm.from;
  if (lm?.to && isWahaPhoneChatId(lm.to)) return lm.to;

  return overviewId;
}

export function formatDigitsAsWhatsAppPhone(
  digits: string,
  defaultIso2 = "DE",
): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 8) return d ? `+${d}` : "WhatsApp";
  const parsed = parseGuestPhone(
    `+${d}`,
    COUNTRIES_REFERENCE_FALLBACK,
    defaultIso2,
  );
  return (
    formatGuestPhone(
      parsed.iso2,
      parsed.local,
      COUNTRIES_REFERENCE_FALLBACK,
    ) ?? `+${d}`
  );
}

/** Formatierte Nummer aus `491…@c.us` / Pseudo-ID — unabhängig vom Overview-Namen. */
export function displayNameFromWahaChatId(
  chatId: string,
  defaultIso2 = "DE",
): string | null {
  const digits = extractPhoneDigitsFromWahaChat(chatId);
  if (!digits) return null;
  const formatted = formatDigitsAsWhatsAppPhone(digits, defaultIso2);
  return isBareWhatsAppPlaceholderName(formatted) ? null : formatted;
}

export function pickReadableName(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    const t = c?.trim() ?? "";
    if (!t) continue;
    if (isWhatsAppJidOrRawNumberLabel(t)) continue;
    if (isBareWhatsAppPlaceholderName(t)) continue;
    return t;
  }
  return null;
}

function stringField(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Verknüpfter Gwada-Kontakt (optional mit Firma). */
export type WahaMatchedGwadaContact = {
  name: string;
  company?: string | null;
};

/** WAHA-Kontakt / Business-Profil — kein Telefon-Label. */
export function displayNameFromWahaContactInfo(
  contact: WahaContactInfo | null | undefined,
): string | null {
  if (!contact) return null;
  const raw = contact as Record<string, unknown>;
  return pickReadableName(
    stringField(raw, "verifiedName"),
    stringField(raw, "formattedTitle"),
    stringField(raw, "businessName"),
    stringField(raw, "companyName"),
    contact.name,
    contact.pushname,
    contact.shortName,
    stringField(raw, "notifyName"),
  );
}

function titleFromMatchedGwadaContact(
  matched: WahaMatchedGwadaContact | null | undefined,
): string | null {
  if (!matched) return null;
  const person = matched.name.trim();
  const company = matched.company?.trim() ?? "";

  if (company) {
    if (
      !person ||
      isBareWhatsAppPlaceholderName(person) ||
      isWhatsAppJidOrRawNumberLabel(person)
    ) {
      return company;
    }
    return `${person} · ${company}`;
  }

  if (
    person &&
    !isBareWhatsAppPlaceholderName(person) &&
    !isWhatsAppJidOrRawNumberLabel(person)
  ) {
    return person;
  }

  return null;
}

/** Gwada-Kontakt: Firma allein oder „Person · Firma“. */
export function formatGwadaContactTitle(
  personName: string,
  company?: string | null,
): string {
  return (
    titleFromMatchedGwadaContact({ name: personName, company }) ?? personName
  );
}

/** Thread-Titel per API nachladen (Platzhalter oder nur Nummer). */
export function needsWahaDisplayNameResolve(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (isBareWhatsAppPlaceholderName(t)) return true;
  if (isPhoneLikeDisplayName(t)) return true;
  return false;
}

/** Gültiger Listen-Titel für Thread-Header (ohne Nummer/JID-Platzhalter). */
export function wahaThreadTitleFromPreview(
  preview: { contact_name?: string | null } | null | undefined,
): string | null {
  const name = preview?.contact_name?.trim() ?? "";
  if (!name || needsWahaDisplayNameResolve(name)) return null;
  return name;
}

/** Lesbarer Titel (Firma, Pushname, Person) — ohne Telefonnummer. */
export function pickWahaChatReadableTitle(params: {
  overviewName?: string | null;
  overviewChat?: WahaChatOverviewItem | null;
  matchedGwada?: WahaMatchedGwadaContact | null;
  wahaContact?: WahaContactInfo | null;
}): string | null {
  const fromGwada = titleFromMatchedGwadaContact(params.matchedGwada);
  if (fromGwada) return fromGwada;

  const fromOverview = params.overviewChat
    ? displayNameFromChatOverview(params.overviewChat)
    : null;
  if (fromOverview) return fromOverview;

  const overviewName = params.overviewName?.trim() ?? "";
  if (
    overviewName &&
    !isBareWhatsAppPlaceholderName(overviewName) &&
    !isWhatsAppJidOrRawNumberLabel(overviewName)
  ) {
    return overviewName;
  }

  return displayNameFromWahaContactInfo(params.wahaContact);
}

/** Namen aus chats/overview (inkl. engine-spezifischem `_chat`, Business). */
export function displayNameFromChatOverview(
  chat: WahaChatOverviewItem,
): string | null {
  const inner =
    chat._chat && typeof chat._chat === "object" && !Array.isArray(chat._chat)
      ? (chat._chat as Record<string, unknown>)
      : null;

  return pickReadableName(
    inner ? stringField(inner, "verifiedName") : null,
    inner ? stringField(inner, "formattedTitle") : null,
    inner ? stringField(inner, "notifyName") : null,
    inner ? stringField(inner, "pushname") : null,
    inner ? stringField(inner, "businessName") : null,
    inner ? stringField(inner, "companyName") : null,
    chat.name,
    inner ? stringField(inner, "name") : null,
    inner ? stringField(inner, "subject") : null,
  );
}

function formattedPhoneTitle(
  chatId: string,
  overviewName: string | null | undefined,
  overviewChat: WahaChatOverviewItem | null | undefined,
  lookupMaps: WahaInboxLookupMaps | undefined,
  preresolvedDigits: string | null | undefined,
  defaultIso2: string,
): string | null {
  const rawDigits =
    preresolvedDigits?.replace(/\D/g, "") ||
    (overviewChat
      ? extractPhoneDigitsFromWahaOverview(overviewChat, lookupMaps)
      : null) ||
    extractPhoneDigitsFromWahaChat(chatId, overviewName ?? overviewChat?.name);

  if (rawDigits && rawDigits.length >= 8) {
    const label = formatDigitsAsWhatsAppPhone(rawDigits, defaultIso2);
    if (!isBareWhatsAppPlaceholderName(label)) return label;
  }

  return displayNameFromWahaChatId(chatId, defaultIso2);
}

/** Anzeige für Liste/Header: Pushname oder formatierte Nummer, nie `…@c.us`. */
export function wahaChatListDisplayName(params: {
  chatId: string;
  overviewName?: string | null;
  overviewChat?: WahaChatOverviewItem | null;
  matchedContactName?: string | null;
  matchedContactCompany?: string | null;
  wahaContact?: WahaContactInfo | null;
  defaultCountryIso2?: string;
  lookupMaps?: WahaInboxLookupMaps;
  preresolvedDigits?: string | null;
}): { label: string; needsApiResolve: boolean } {
  const iso = params.defaultCountryIso2 ?? "DE";

  const readableTitle = pickWahaChatReadableTitle({
    overviewName: params.overviewName,
    overviewChat: params.overviewChat,
    matchedGwada: params.matchedContactName
      ? {
          name: params.matchedContactName,
          company: params.matchedContactCompany,
        }
      : null,
    wahaContact: params.wahaContact,
  });

  if (readableTitle) {
    return { label: readableTitle, needsApiResolve: false };
  }

  const phoneLabel = formattedPhoneTitle(
    params.chatId,
    params.overviewName,
    params.overviewChat,
    params.lookupMaps,
    params.preresolvedDigits,
    iso,
  );
  if (phoneLabel) {
    return { label: phoneLabel, needsApiResolve: false };
  }

  return { label: "WhatsApp", needsApiResolve: true };
}

/** Listen-/Header-Titel: Firma/Pushname bevorzugen, sonst Nummer aus Chat-ID. */
export function wahaConversationDisplayName(
  preview: { contact_id: string; contact_name: string },
  defaultIso2 = "DE",
): string {
  const name = preview.contact_name.trim();
  if (
    name &&
    !isBareWhatsAppPlaceholderName(name) &&
    !isWhatsAppJidOrRawNumberLabel(name)
  ) {
    return name;
  }
  if (!isWahaPseudoContactId(preview.contact_id)) {
    return preview.contact_name;
  }
  const chatId = wahaChatIdFromPseudoContactId(preview.contact_id);
  if (!chatId) return preview.contact_name;
  return displayNameFromWahaChatId(chatId, defaultIso2) ?? preview.contact_name;
}
