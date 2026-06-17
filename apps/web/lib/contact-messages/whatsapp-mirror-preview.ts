import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import type {
  ContactMessageAttachment,
  ContactMessageAttachmentKind,
} from "@/lib/types/contact-message-attachment";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

const WHATSAPP_MIRROR_PLACEHOLDER_BODIES = new Set([
  "",
  "Anhang",
  "WhatsApp-Anhang",
  "datei",
  "Datei",
]);

/** DB-Spiegeltext für WAHA-Nachrichten ohne Text (Sync / Webhook). */
export function whatsappMirrorBodyFromContactRow(m: ContactMessageRow): string {
  const text = m.body.trim();
  if (text) return text;
  const att = m.attachments?.[0];
  if (!att) return "";
  if (att.kind === "voice") return "Sprachnachricht";
  if (att.kind === "video") return "Video";
  if (att.kind === "image") return "Bild";
  return att.fileName || "Datei";
}

export function isWhatsappMirrorPlaceholderBody(body: string): boolean {
  return WHATSAPP_MIRROR_PLACEHOLDER_BODIES.has(body.trim());
}

export function isRedundantWhatsappMediaBody(
  body: string,
  attachments?: ContactMessageAttachment[] | null,
): boolean {
  const t = body.trim();
  if (!t || !attachments?.length) return false;
  if (isWhatsappMirrorPlaceholderBody(t)) return true;
  const kind = attachments[0]?.kind;
  if (kind === "voice" && t === "Sprachnachricht") return true;
  if (kind === "video" && t === "Video") return true;
  if (kind === "image" && t === "Bild") return true;
  if (kind === "file" && (t === "Datei" || t === "datei")) return true;
  return false;
}

/** Vorschau in der Konversationsliste (DB-Spiegel mit Medien-Label). */
export function previewBodyAndKindFromWhatsappMirror(body: string): {
  body: string;
  attachmentKind?: ContactMessageAttachmentKind;
} {
  const t = body.trim();
  if (t === "Sprachnachricht") return { body: "", attachmentKind: "voice" };
  if (t === "Video") return { body: "", attachmentKind: "video" };
  if (t === "Bild") return { body: "", attachmentKind: "image" };
  if (t === "Datei" || t === "datei") return { body: "", attachmentKind: "file" };
  if (isWhatsappMirrorPlaceholderBody(t)) return { body: "" };
  return { body: t };
}

/** Leerer WAHA-DB-Spiegel ohne WAHA-ID — live-Verlauf hat die echte Sprach-/Mediennachricht. */
export function filterRedundantWhatsappDbMirrorRows(
  dbMessages: ContactMessageRow[],
  wahaMessages: ContactMessageRow[] | null | undefined,
): ContactMessageRow[] {
  if (!wahaMessages?.length) return dbMessages;

  return dbMessages.filter((m) => {
    if (messageDisplayPlatform(m) !== "whatsapp") return true;
    if (m.external_source_id?.startsWith("waha:")) return true;
    if (m.attachments?.length) return true;
    const text = m.body.trim();
    if (
      text &&
      !isWhatsappMirrorPlaceholderBody(text) &&
      text !== "Sprachnachricht" &&
      text !== "Video" &&
      text !== "Bild"
    ) {
      return true;
    }
    return false;
  });
}

const WAHA_DEDUPE_WINDOW_MS = 3 * 60 * 1000;

function wahaMessageDedupeKey(m: ContactMessageRow): string {
  return `${m.direction}|${m.body.trim()}`;
}

function isNearTimestamp(a: string, b: string, windowMs: number): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false;
  return Math.abs(ta - tb) <= windowMs;
}

/** WAHA-Live-Zeile oder DB-Sync mit bekannter Nachrichten-ID. */
export function isWhatsappSyncAnchorRow(m: ContactMessageRow): boolean {
  if (m.waha_message_id) return true;
  if (m.id.startsWith("waha:")) return true;
  return m.external_source_id?.startsWith("waha:") ?? false;
}

/** Gleicher Send inkl. Reservierungs-Kontext (längerer WAHA-Text enthält Gwada-Body). */
export function bodiesIndicateSameWhatsappSend(a: string, b: string): boolean {
  const x = a.trim();
  const y = b.trim();
  if (!x && !y) return true;
  if (!x || !y) return false;
  if (x === y) return true;
  return y.includes(x) || x.includes(y);
}

function isNearbyWhatsappDuplicateSend(
  message: ContactMessageRow,
  other: ContactMessageRow,
): boolean {
  if (other.id === message.id) return false;
  if (other.direction !== message.direction) return false;
  if (messageDisplayPlatform(other) !== "whatsapp") return false;
  if (!isNearTimestamp(other.created_at, message.created_at, WAHA_DEDUPE_WINDOW_MS)) {
    return false;
  }
  if (
    bodiesIndicateSameWhatsappSend(message.body, other.body) ||
    (!message.body.trim() && !other.body.trim())
  ) {
    return true;
  }
  const messageKind = message.attachments?.[0]?.kind;
  const otherKind = other.attachments?.[0]?.kind;
  return Boolean(messageKind && otherKind && messageKind === otherKind);
}

/** Send-Spiegel entfernen, wenn WAHA-Anker in der Nähe existiert. */
export function dedupeWhatsappOutboundThreadRows(
  messages: ContactMessageRow[],
): ContactMessageRow[] {
  return messages.filter((message) => {
    if (messageDisplayPlatform(message) !== "whatsapp") return true;
    if (message.direction !== "outbound") return true;
    if (isWhatsappSyncAnchorRow(message)) return true;

    const hasNearbyAnchor = messages.some(
      (other) =>
        isWhatsappSyncAnchorRow(other) &&
        isNearbyWhatsappDuplicateSend(message, other),
    );
    return !hasNearbyAnchor;
  });
}

/** Send-DB-Zeile ohne `waha:`-ID, die im WAHA-Verlauf/Sync schon vorkommt. */
export function isDuplicateWhatsappDbSendMirror(
  message: ContactMessageRow,
  dbMessages: ContactMessageRow[],
  wahaMessages: ContactMessageRow[],
): boolean {
  if (messageDisplayPlatform(message) !== "whatsapp") return false;
  if (message.external_source_id?.startsWith("waha:")) return false;

  const text = message.body.trim();
  const hasOnlyMedia =
    !text ||
    isWhatsappMirrorPlaceholderBody(text) ||
    Boolean(message.attachments?.length);

  if (!hasOnlyMedia && !text) return false;

  const hasNearbySyncedWaha = dbMessages.some(
    (other) =>
      isWhatsappSyncAnchorRow(other) &&
      isNearbyWhatsappDuplicateSend(message, other),
  );
  if (hasNearbySyncedWaha) return true;

  const hasSyncedTwin = dbMessages.some(
    (other) =>
      other.id !== message.id &&
      other.external_source_id?.startsWith("waha:") &&
      other.direction === message.direction &&
      bodiesIndicateSameWhatsappSend(other.body, text) &&
      isNearTimestamp(other.created_at, message.created_at, WAHA_DEDUPE_WINDOW_MS),
  );
  if (hasSyncedTwin) return true;

  return wahaMessages.some(
    (w) =>
      w.direction === message.direction &&
      isNearTimestamp(w.created_at, message.created_at, WAHA_DEDUPE_WINDOW_MS) &&
      (hasOnlyMedia
        ? Boolean(w.attachments?.length || message.attachments?.length)
        : bodiesIndicateSameWhatsappSend(text, w.body)),
  );
}

/**
 * WAHA-Live-Verlauf mit DB zusammenführen: Anreichern, leere Spiegel entfernen,
 * Send-Duplikate deduplizieren, fehlende WAHA-Nachrichten ergänzen.
 */
export function mergeDbMessagesWithWahaThread(
  dbMessages: ContactMessageRow[],
  wahaMessages: ContactMessageRow[] | null | undefined,
): ContactMessageRow[] {
  const waha = wahaMessages ?? [];
  if (!waha.length) return dbMessages;

  const filtered = dbMessages.filter((m) => {
    if (isDuplicateWhatsappDbSendMirror(m, dbMessages, waha)) return false;
    return filterRedundantWhatsappDbMirrorRows([m], waha).length > 0;
  });

  const enriched = enrichDbMessagesWithWahaMedia(filtered, waha);

  const coveredWahaIds = new Set<string>();
  for (const m of filtered) {
    const ext = m.external_source_id?.trim();
    if (ext?.startsWith("waha:")) coveredWahaIds.add(ext);
  }

  const wahaKeysInEnriched = new Set(enriched.map(wahaMessageDedupeKey));
  const wahaOnly = waha.filter((m) => {
    if (coveredWahaIds.has(m.id)) return false;
    return !wahaKeysInEnriched.has(wahaMessageDedupeKey(m));
  });

  return dedupeWhatsappOutboundThreadRows([...enriched, ...wahaOnly]);
}

export function messageHasVisibleBubbleContent(m: ContactMessageRow): boolean {
  if (m.attachments?.length) return true;
  if (m.body_html?.trim()) return true;
  const text = m.body.trim();
  if (!text) return false;
  return !isRedundantWhatsappMediaBody(text, m.attachments);
}

/** WAHA: Text oder Medien-Beschriftung bearbeitbar (keine reine Sprachnachricht). */
export function isWahaEditableMessage(m: ContactMessageRow): boolean {
  const text = m.body.trim();
  if (!text) return false;
  return !isRedundantWhatsappMediaBody(text, m.attachments);
}

/** WAHA-Metadaten (Anhänge, Reactions) auf DB-Zeilen legen. */
export function enrichDbMessagesWithWahaMedia(
  dbMessages: ContactMessageRow[],
  wahaMessages: ContactMessageRow[],
): ContactMessageRow[] {
  const wahaByExternalId = new Map<string, ContactMessageRow>();
  for (const m of wahaMessages) {
    wahaByExternalId.set(m.id, m);
    if (m.waha_message_id) {
      wahaByExternalId.set(`waha:${m.waha_message_id}`, m);
    }
  }

  return dbMessages.map((m) => {
    const ext = m.external_source_id?.trim();
    if (!ext?.startsWith("waha:")) return m;

    const waha = wahaByExternalId.get(ext);
    if (!waha) return m;

    const wahaMessageId = m.waha_message_id ?? ext.slice(5);
    const mirrorBody = whatsappMirrorBodyFromContactRow(waha);
    const resolvedAttachments = waha.attachments?.length
      ? waha.attachments
      : m.attachments;

    const wahaText = waha.body.trim();
    let body = m.body;
    if (
      wahaText &&
      !isRedundantWhatsappMediaBody(wahaText, resolvedAttachments)
    ) {
      body = wahaText;
    } else if (isRedundantWhatsappMediaBody(body, resolvedAttachments)) {
      body = "";
    } else if (
      (!body.trim() || isWhatsappMirrorPlaceholderBody(body)) &&
      mirrorBody &&
      !isRedundantWhatsappMediaBody(mirrorBody, resolvedAttachments)
    ) {
      body = mirrorBody;
    }

    return {
      ...m,
      waha_message_id: wahaMessageId,
      body,
      attachments: resolvedAttachments?.length ? resolvedAttachments : m.attachments,
      waha_ack: maxWahaAck(m.waha_ack, waha.waha_ack),
      reactions: waha.reactions?.length ? waha.reactions : m.reactions,
    };
  });
}

export function resolveWahaMessageKey(
  message: ContactMessageRow,
): string | null {
  if (message.waha_message_id) return message.waha_message_id;
  if (message.id.startsWith("waha:")) return message.id.slice(5);
  const ext = message.external_source_id?.trim();
  if (ext?.startsWith("waha:")) return ext.slice(5);
  return null;
}

export function maxWahaAck(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  const left = a ?? null;
  const right = b ?? null;
  if (left == null) return right;
  if (right == null) return left;
  return Math.max(left, right);
}

function findMatchingLiveOutboundMessage(
  message: ContactMessageRow,
  wahaLive: ContactMessageRow[],
): ContactMessageRow | null {
  let best: ContactMessageRow | null = null;
  let bestDelta = Infinity;
  const messageTime = Date.parse(message.created_at);

  for (const live of wahaLive) {
    if (live.direction !== "outbound") continue;
    if (messageDisplayPlatform(live) !== "whatsapp") continue;
    if (!isNearbyWhatsappDuplicateSend(message, live)) continue;

    if (!Number.isFinite(messageTime)) return live;

    const liveTime = Date.parse(live.created_at);
    if (!Number.isFinite(liveTime)) continue;

    const delta = Math.abs(liveTime - messageTime);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = live;
    }
  }

  return best;
}

function patchMessageFromWahaLive(
  message: ContactMessageRow,
  live: ContactMessageRow,
  opts?: { preferLiveIdentity?: boolean },
): ContactMessageRow {
  const key = resolveWahaMessageKey(live);
  if (!key) return message;

  return {
    ...message,
    ...(opts?.preferLiveIdentity
      ? {
          id: live.id,
          external_source_id: live.external_source_id ?? live.id,
          created_at: live.created_at,
        }
      : null),
    waha_message_id: key,
    waha_ack: maxWahaAck(message.waha_ack, live.waha_ack),
    delivery_status: live.delivery_status ?? message.delivery_status,
    reactions: live.reactions?.length ? live.reactions : message.reactions,
    attachments: live.attachments?.length ? live.attachments : message.attachments,
  };
}

/** ACK / Reactions von WAHA-Live auf bestehende Thread-Zeilen legen ( nie ACK zurückdrehen ). */
export function mergeWahaLiveMetadataIntoThread(
  messages: ContactMessageRow[],
  wahaLive: ContactMessageRow[],
): ContactMessageRow[] {
  if (!wahaLive.length) return messages;

  const liveByKey = new Map<string, ContactMessageRow>();
  for (const live of wahaLive) {
    const key = resolveWahaMessageKey(live);
    if (key) liveByKey.set(key, live);
  }

  return messages.map((message) => {
    const key = resolveWahaMessageKey(message);
    if (key) {
      const live = liveByKey.get(key);
      if (!live) return message;
      return patchMessageFromWahaLive(message, live);
    }

    if (
      messageDisplayPlatform(message) !== "whatsapp" ||
      message.direction !== "outbound"
    ) {
      return message;
    }

    const liveMatch = findMatchingLiveOutboundMessage(message, wahaLive);
    if (!liveMatch) return message;

    return patchMessageFromWahaLive(message, liveMatch, {
      preferLiveIdentity: true,
    });
  });
}

function reactionsSignature(reactions: ContactMessageRow["reactions"]): string {
  if (!reactions?.length) return "";
  return reactions
    .map((r) => `${r.emoji}:${r.fromMe ? 1 : 0}`)
    .sort()
    .join("|");
}

/** Prüft, ob WAHA-Metadaten (ACK/Reactions) zwischen zwei Thread-Snapshots gleich sind. */
export function wahaMetadataThreadsEqual(
  before: ContactMessageRow[],
  after: ContactMessageRow[],
): boolean {
  if (before.length !== after.length) return false;
  for (let i = 0; i < before.length; i++) {
    const a = before[i]!;
    const b = after[i]!;
    if (a.id !== b.id) return false;
    if (a.waha_ack !== b.waha_ack) return false;
    if (a.waha_message_id !== b.waha_message_id) return false;
    if (a.delivery_status !== b.delivery_status) return false;
    if (reactionsSignature(a.reactions) !== reactionsSignature(b.reactions)) {
      return false;
    }
  }
  return true;
}

/** Wie {@link mergeWahaLiveMetadataIntoThread}, aber ohne neue Array-Referenz wenn nichts ändert. */
export function mergeWahaLiveMetadataIntoThreadIfChanged(
  messages: ContactMessageRow[],
  wahaLive: ContactMessageRow[],
): ContactMessageRow[] {
  const next = mergeWahaLiveMetadataIntoThread(messages, wahaLive);
  return wahaMetadataThreadsEqual(messages, next) ? messages : next;
}

/** Outbound-WhatsApp mit ausstehendem ACK — dann lohnt sich häufigeres Polling. */
export function contactThreadNeedsWahaAckPoll(
  messages: ContactMessageRow[],
): boolean {
  return messages.some(
    (m) =>
      m.direction === "outbound" &&
      (m.waha_message_id != null || messageDisplayPlatform(m) === "whatsapp") &&
      (m.waha_ack ?? 0) < 3,
  );
}
