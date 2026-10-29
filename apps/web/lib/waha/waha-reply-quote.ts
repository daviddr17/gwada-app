import type { WahaChatMessage } from "@/lib/waha/waha-inbox";

export type WahaReplyQuote = {
  /** WAHA message id of the quoted message (without waha: prefix). */
  messageId: string | null;
  body: string;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Quote/Reply-Kontext aus WAHA-Payload (`replyTo` oder `_data` ContextInfo).
 * Kanal-agnostisch nutzbar: nur WAHA-Felder lesen.
 */
export function parseWahaReplyQuote(
  message: Pick<WahaChatMessage, "id" | "body" | "_data"> & {
    replyTo?: unknown;
  },
): WahaReplyQuote | null {
  const top = asRecord(message.replyTo);
  if (top) {
    const messageId = readString(top.id) || null;
    const body =
      readString(top.body) ||
      (top.hasMedia === true ? "Anhang" : "");
    if (messageId || body) {
      return { messageId, body: body || "Nachricht" };
    }
  }

  const data = asRecord(message._data);
  if (!data) return null;

  const contextInfo =
    asRecord(data.contextInfo) ??
    asRecord(asRecord(data.message)?.extendedTextMessage)?.contextInfo ??
    asRecord(asRecord(data.message)?.imageMessage)?.contextInfo ??
    asRecord(asRecord(data.message)?.documentMessage)?.contextInfo ??
    null;

  if (!contextInfo) return null;

  const stanzaId = readString(contextInfo.stanzaId);
  const quoted = asRecord(contextInfo.quotedMessage);
  const quotedConversation =
    readString(quoted?.conversation) ||
    readString(asRecord(quoted?.extendedTextMessage)?.text) ||
    readString(asRecord(quoted?.imageMessage)?.caption) ||
    (quoted ? "Anhang" : "");

  if (!stanzaId && !quotedConversation) return null;

  return {
    messageId: stanzaId || null,
    body: quotedConversation || "Nachricht",
  };
}

export function wahaExternalSourceId(messageId: string): string {
  const id = messageId.trim();
  if (!id) return "";
  return id.startsWith("waha:") ? id : `waha:${id}`;
}

export function wahaMessageIdFromExternalSourceId(
  externalSourceId: string | null | undefined,
): string | null {
  const raw = externalSourceId?.trim() ?? "";
  if (!raw.startsWith("waha:")) return null;
  const id = raw.slice("waha:".length).trim();
  return id || null;
}
