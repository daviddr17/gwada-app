import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";

export function gwadaAttachmentDownloadUrl(params: {
  restaurantId: string;
  messageId: string;
  attachmentId: string;
}): string {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    messageId: params.messageId,
    attachmentId: params.attachmentId,
  });
  return `/api/contact-messages/attachments/download?${q.toString()}`;
}

export function wahaMediaProxyUrl(params: {
  restaurantId: string;
  chatId: string;
  messageId: string;
}): string {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    messageId: params.messageId,
  });
  return `/api/contact-messages/waha/media?${q.toString()}`;
}

export function emailAttachmentProxyUrl(params: {
  restaurantId: string;
  uid: number;
  index: number;
}): string {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    uid: String(params.uid),
    index: String(params.index),
  });
  return `/api/contact-messages/email/attachment?${q.toString()}`;
}

export function imapUidFromMessageId(messageId: string): number | null {
  if (!messageId.startsWith("imap:")) return null;
  const n = Number.parseInt(messageId.slice(5), 10);
  return Number.isFinite(n) ? n : null;
}

export function wahaMessageIdFromRowId(messageId: string): string | null {
  if (!messageId.startsWith("waha:")) return null;
  const id = messageId.slice(5).trim();
  return id.length > 0 ? id : null;
}

export function buildAttachmentUrlForMessage(params: {
  platform: ContactMessagePlatform;
  restaurantId: string;
  messageId: string;
  attachmentId: string;
  wahaChatId?: string | null;
}): string {
  if (params.platform === "whatsapp" && params.wahaChatId) {
    const wahaId = wahaMessageIdFromRowId(params.messageId) ?? params.messageId;
    return wahaMediaProxyUrl({
      restaurantId: params.restaurantId,
      chatId: params.wahaChatId,
      messageId: wahaId,
    });
  }
  if (params.platform === "email") {
    const uid = imapUidFromMessageId(params.messageId);
    if (uid != null) {
      const index = Number.parseInt(params.attachmentId, 10);
      return emailAttachmentProxyUrl({
        restaurantId: params.restaurantId,
        uid,
        index: Number.isFinite(index) ? index : 0,
      });
    }
  }
  return gwadaAttachmentDownloadUrl({
    restaurantId: params.restaurantId,
    messageId: params.messageId,
    attachmentId: params.attachmentId,
  });
}
