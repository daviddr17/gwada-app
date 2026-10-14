import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";
import {
  parseWahaMessageMedia,
  wahaMediaPreviewLabel,
} from "@/lib/contact-messages/waha-message-media";
import type { WahaChatMessage } from "@/lib/waha/waha-inbox";

function mediaMirrorBody(kind: ContactMessageAttachmentKind | null): string {
  if (kind === "image") return "Bild";
  if (kind === "voice") return "Sprachnachricht";
  if (kind === "video") return "Video";
  if (kind) return "Datei";
  return "WhatsApp-Anhang";
}

function readStringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/** WAHA wraps business/media payloads in ephemeral / view-once / edit shells. */
export function unwrapWahaProtobufMessage(
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!data) return null;
  const message = asRecord(data.message) ?? data;
  if (!message) return null;

  const wrappers = [
    "ephemeralMessage",
    "viewOnceMessage",
    "viewOnceMessageV2",
    "viewOnceMessageV2Extension",
    "documentWithCaptionMessage",
    "editedMessage",
    "futureProofMessage",
  ] as const;

  for (const key of wrappers) {
    const wrapped = asRecord(message[key]);
    const nested = asRecord(wrapped?.message);
    if (nested) return unwrapWahaProtobufMessage({ message: nested });
  }

  return message;
}

function textFromMediaNode(node: Record<string, unknown> | null): string {
  if (!node) return "";
  return (
    readStringField(node.caption) ||
    readStringField(node.text) ||
    readStringField(node.title) ||
    readStringField(node.description) ||
    readStringField(node.contentText) ||
    readStringField(node.name) ||
    ""
  );
}

function productDisplayText(node: Record<string, unknown> | null): string {
  if (!node) return "";
  const title =
    readStringField(node.title) ||
    readStringField(node.name) ||
    readStringField(node.productTitle);
  const description =
    readStringField(node.description) ||
    readStringField(node.body) ||
    readStringField(node.productDescription);
  const currency = readStringField(node.currencyCode) || readStringField(node.currency);
  const priceRaw = node.priceAmount1000 ?? node.price;
  let price = "";
  if (typeof priceRaw === "number" && Number.isFinite(priceRaw)) {
    price =
      priceRaw >= 1000
        ? `${(priceRaw / 1000).toFixed(2)}${currency ? ` ${currency}` : ""}`
        : `${priceRaw}${currency ? ` ${currency}` : ""}`;
  } else {
    price = readStringField(priceRaw);
  }
  return [title, description, price].filter(Boolean).join("\n").trim();
}

/**
 * Caption / body text from WAHA top-level fields or WhatsApp protobuf `_data`.
 * Covers image+caption, extended text (link preview), catalog/product, buttons, lists.
 */
type WahaDisplayTextSource = {
  body?: string | null;
  caption?: string | null;
  hasMedia?: boolean | null;
  type?: string | null;
  _data?: unknown;
  media?: {
    caption?: string | null;
    url?: string | null;
    mimetype?: string | null;
    filename?: string | null;
  } | null;
};

export function extractWahaMessageDisplayText(raw: WahaDisplayTextSource): string {
  const mediaCaption =
    raw.media && typeof raw.media === "object"
      ? readStringField((raw.media as { caption?: unknown }).caption)
      : "";
  const top =
    readStringField(raw.body) ||
    readStringField(raw.caption) ||
    mediaCaption;
  if (top) return top;

  const data = asRecord(raw._data);
  if (!data) return "";

  const topDataCaption =
    readStringField(data.caption) ||
    readStringField(data.body) ||
    readStringField(data.text);
  if (topDataCaption) return topDataCaption;

  const message = unwrapWahaProtobufMessage(data);
  if (!message) return "";

  const conversation = readStringField(message.conversation);
  if (conversation) return conversation;

  const extended = asRecord(message.extendedTextMessage);
  const extendedText =
    readStringField(extended?.text) || readStringField(extended?.description);
  if (extendedText) return extendedText;

  for (const key of [
    "imageMessage",
    "videoMessage",
    "documentMessage",
    "audioMessage",
    "pttMessage",
    "stickerMessage",
  ] as const) {
    const caption = textFromMediaNode(asRecord(message[key]));
    if (caption) return caption;
  }

  const buttons = asRecord(message.buttonsMessage);
  const buttonsText =
    readStringField(buttons?.contentText) ||
    readStringField(buttons?.headerText) ||
    readStringField(buttons?.footerText);
  if (buttonsText) return buttonsText;

  const list = asRecord(message.listMessage);
  const listText =
    readStringField(list?.description) ||
    readStringField(list?.title) ||
    readStringField(list?.footerText);
  if (listText) return listText;

  const template = asRecord(message.templateMessage);
  const hydrated = asRecord(template?.hydratedTemplate);
  const templateText =
    readStringField(hydrated?.hydratedContentText) ||
    readStringField(hydrated?.hydratedTitleText) ||
    readStringField(asRecord(template?.fourRowTemplate)?.content);
  if (templateText) return String(templateText);

  const interactive = asRecord(message.interactiveMessage);
  const interactiveBody = asRecord(interactive?.body);
  const interactiveText =
    readStringField(interactiveBody?.text) ||
    readStringField(asRecord(interactive?.header)?.title) ||
    readStringField(asRecord(interactive?.footer)?.text);
  if (interactiveText) return interactiveText;

  const product =
    asRecord(message.productMessage) ??
    asRecord(asRecord(message.productMessage)?.product) ??
    asRecord(message.product);
  const productText = productDisplayText(product);
  if (productText) return productText;

  const order = asRecord(message.orderMessage);
  const orderText =
    readStringField(order?.orderTitle) ||
    readStringField(order?.message) ||
    readStringField(order?.sellerJid);
  if (orderText) return orderText;

  const contact = asRecord(message.contactMessage);
  const contactText =
    readStringField(contact?.displayName) || readStringField(contact?.vcard);
  if (contactText) return contactText;

  const location = asRecord(message.locationMessage);
  const locationText =
    readStringField(location?.name) ||
    readStringField(location?.address) ||
    readStringField(location?.comment);
  if (locationText) return locationText;

  return "";
}

function protobufHasThumbnail(message: Record<string, unknown>): boolean {
  const extended = asRecord(message.extendedTextMessage);
  if (extended?.jpegThumbnail) return true;
  for (const key of ["imageMessage", "videoMessage", "documentMessage", "stickerMessage"] as const) {
    const node = asRecord(message[key]);
    if (node?.jpegThumbnail || node?.mediaKey || node?.url || node?.directPath) {
      return true;
    }
  }
  return Boolean(
    message.productMessage ||
      message.orderMessage ||
      message.buttonsMessage ||
      message.listMessage ||
      message.templateMessage ||
      message.interactiveMessage,
  );
}

export function detectWahaMessageMediaKind(
  raw: WahaDisplayTextSource,
): ContactMessageAttachmentKind | null {
  const parsed = parseWahaMessageMedia(raw as WahaChatMessage);
  if (parsed) return parsed.kind;

  const data = asRecord(raw._data);
  const message = unwrapWahaProtobufMessage(data ?? undefined);
  if (!message) return null;

  if (message.imageMessage || message.stickerMessage) return "image";
  if (message.videoMessage) return "video";
  if (message.audioMessage || message.pttMessage) return "voice";
  if (message.documentMessage) return "file";
  if (
    message.productMessage ||
    message.orderMessage ||
    (asRecord(message.extendedTextMessage)?.jpegThumbnail &&
      !readStringField(asRecord(message.extendedTextMessage)?.text))
  ) {
    return "image";
  }
  if (protobufHasThumbnail(message) && !extractWahaMessageDisplayText(raw)) {
    return "image";
  }
  return null;
}

export type WahaInboundMirrorContent = {
  body: string;
  mediaKind: ContactMessageAttachmentKind | null;
  hasContent: boolean;
};

/**
 * Body + media kind for DB mirror / webhook ingest.
 * Prefers real caption/text; falls back to media label; never blank when content exists.
 */
export function resolveWahaInboundMirrorContent(
  raw: WahaDisplayTextSource,
): WahaInboundMirrorContent {
  const mediaKind = detectWahaMessageMediaKind(raw);
  const text = extractWahaMessageDisplayText(raw);
  if (text) {
    return { body: text, mediaKind, hasContent: true };
  }
  if (mediaKind) {
    return {
      body: mediaMirrorBody(mediaKind),
      mediaKind,
      hasContent: true,
    };
  }
  const label = wahaMediaPreviewLabel(raw as WahaChatMessage);
  if (label) {
    return { body: label, mediaKind: mediaKind ?? "file", hasContent: true };
  }
  return { body: "", mediaKind: null, hasContent: false };
}
