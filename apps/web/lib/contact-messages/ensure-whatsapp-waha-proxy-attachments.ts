import { wahaMediaProxyUrl } from "@/lib/contact-messages/contact-message-attachment-urls";
import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import {
  isWhatsappMirrorPlaceholderBody,
  resolveWahaMessageKey,
} from "@/lib/contact-messages/whatsapp-mirror-preview";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

/** DB-/Webhook-Spiegeltexte für WhatsApp-Medien ohne echte Caption. */
export function attachmentKindFromWhatsappMirrorBody(
  body: string,
): ContactMessageAttachmentKind | null {
  const t = body.replace(/\s+/g, " ").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower === "sprachnachricht") return "voice";
  if (lower === "video") return "video";
  if (lower === "bild") return "image";
  if (
    lower === "datei" ||
    lower === "anhang" ||
    lower === "whatsapp-anhang" ||
    isWhatsappMirrorPlaceholderBody(t)
  ) {
    return "file";
  }
  return null;
}

function mimeForAttachmentKind(kind: ContactMessageAttachmentKind): string {
  if (kind === "image") return "image/jpeg";
  if (kind === "voice") return "audio/ogg; codecs=opus";
  if (kind === "video") return "video/mp4";
  return "application/octet-stream";
}

function displayFileNameForKind(
  kind: ContactMessageAttachmentKind,
  body: string,
): string {
  const t = body.trim();
  if (kind === "image") return "Bild";
  if (kind === "voice") return "Sprachnachricht";
  if (kind === "video") return "Video";
  if (
    t &&
    t.toLowerCase() !== "datei" &&
    !isWhatsappMirrorPlaceholderBody(t)
  ) {
    return t;
  }
  return "Datei";
}

function isGenericDateiFileName(fileName: string | null | undefined): boolean {
  const t = fileName?.trim().toLowerCase() ?? "";
  return t === "datei" || t === "anhang" || t === "whatsapp-anhang";
}

/**
 * WAHA-Spiegelzeilen speichern oft nur „datei“/„Datei“ ohne
 * `contact_message_attachments`. Für die Bubble einen Download über den
 * WAHA-Media-Proxy anbinden.
 */
export function ensureWhatsappWahaProxyAttachments(
  messages: ContactMessageRow[],
  params: { restaurantId: string; chatId: string | null | undefined },
): ContactMessageRow[] {
  const chatId = params.chatId?.trim();
  const restaurantId = params.restaurantId.trim();
  if (!chatId || !restaurantId) return messages;

  return messages.map((m) => {
    if (messageDisplayPlatform(m) !== "whatsapp") return m;

    const wahaMessageId = resolveWahaMessageKey(m);
    if (!wahaMessageId) return m;

    const proxyUrl = wahaMediaProxyUrl({
      restaurantId,
      chatId,
      messageId: wahaMessageId,
    });

    if (m.attachments?.length) {
      let changed = false;
      const nextAttachments = m.attachments.map((att) => {
        const needsName =
          isGenericDateiFileName(att.fileName) || !att.fileName.trim();
        const needsUrl = !att.url?.trim();
        if (!needsName && !needsUrl) return att;
        changed = true;
        return {
          ...att,
          fileName: needsName
            ? displayFileNameForKind(att.kind, m.body)
            : att.fileName,
          url: needsUrl ? proxyUrl : att.url,
          ...(att.kind === "image" && needsUrl
            ? { loadOnClick: true as const }
            : {}),
        };
      });
      if (!changed) return m;
      return {
        ...m,
        waha_message_id: m.waha_message_id ?? wahaMessageId,
        attachments: nextAttachments,
      };
    }

    const kind = attachmentKindFromWhatsappMirrorBody(m.body);
    if (!kind) return m;

    return {
      ...m,
      waha_message_id: m.waha_message_id ?? wahaMessageId,
      attachments: [
        {
          id: "waha-media",
          kind,
          fileName: displayFileNameForKind(kind, m.body),
          mimeType: mimeForAttachmentKind(kind),
          url: proxyUrl,
          loadOnClick: kind === "image" ? true : undefined,
        },
      ],
    };
  });
}
