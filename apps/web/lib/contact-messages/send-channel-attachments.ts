import "server-only";

import {
  wahaSendFile,
  wahaSendImage,
  wahaSendVideo,
  wahaSendVoice,
} from "@/lib/whatsapp/waha-send-media";
import type { OutboundAttachmentFile } from "@/lib/contact-messages/outbound-attachment-files";
import { outboundAttachmentSendKind } from "@/lib/contact-messages/outbound-attachment-files";
import type { SmtpAttachmentPart } from "@/lib/email/send-via-smtp";

export async function sendWhatsappVoiceNote(params: {
  restaurantId: string;
  chatId: string;
  file: OutboundAttachmentFile;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return wahaSendVoice({
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    file: {
      fileName: params.file.fileName,
      mimeType: params.file.mimeType,
      base64: params.file.bytes.toString("base64"),
    },
  });
}

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

    const kind = outboundAttachmentSendKind(file.mimeType);
    const sent =
      kind === "image"
        ? await wahaSendImage(payload)
        : kind === "video"
          ? await wahaSendVideo(payload)
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
