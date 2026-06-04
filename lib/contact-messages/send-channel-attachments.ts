import "server-only";

import { wahaSendFile, wahaSendImage } from "@/lib/whatsapp/waha-send-media";
import type { OutboundAttachmentFile } from "@/lib/contact-messages/outbound-attachment-files";
import { attachmentKindFromMime } from "@/lib/contact-messages/outbound-attachment-files";
import type { SmtpAttachmentPart } from "@/lib/email/send-via-smtp";

export async function sendWhatsappAttachmentFiles(params: {
  restaurantId: string;
  chatId: string;
  files: OutboundAttachmentFile[];
  caption?: string;
}): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const caption = params.caption?.trim() || undefined;
  const list = params.files;

  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    const isLast = i === list.length - 1;
    const fileCaption = isLast ? caption : undefined;
    const base64 = file.bytes.toString("base64");
    const payload = {
      restaurantId: params.restaurantId,
      chatId: params.chatId,
      file: {
        fileName: file.fileName,
        mimeType: file.mimeType,
        base64,
      },
      caption: fileCaption,
    };

    const sent =
      attachmentKindFromMime(file.mimeType) === "image"
        ? await wahaSendImage(payload)
        : await wahaSendFile(payload);

    if (!sent.ok) {
      errors.push(`whatsapp:${sent.error}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function smtpPartsFromOutboundFiles(
  files: OutboundAttachmentFile[],
): SmtpAttachmentPart[] {
  return files.map((f) => ({
    filename: f.fileName,
    content: f.bytes,
    contentType: f.mimeType,
  }));
}
