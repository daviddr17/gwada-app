import "server-only";

import type { Attachment } from "mailparser";
import type { ParsedMail } from "mailparser";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";
import { emailAttachmentProxyUrl } from "@/lib/contact-messages/contact-message-attachment-urls";
import {
  attachmentKindFromMime,
} from "@/lib/contact-messages/outbound-attachment-files";

export type ImapParsedAttachment = {
  index: number;
  fileName: string;
  mimeType: string;
  byteSize: number | null;
  content: Buffer;
};

export function attachmentsFromParsedMail(mail: ParsedMail): ImapParsedAttachment[] {
  const list = mail.attachments ?? [];
  const out: ImapParsedAttachment[] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i] as Attachment;
    const content = a.content;
    if (!content) continue;
    const bytes = Buffer.isBuffer(content)
      ? content
      : Buffer.from(content as Uint8Array);
    if (bytes.length === 0) continue;
    const mimeType = a.contentType?.split(";")[0]?.trim() || "application/octet-stream";
    out.push({
      index: i,
      fileName: a.filename?.trim() || `anhang-${i + 1}`,
      mimeType,
      byteSize: a.size ?? bytes.length,
      content: bytes,
    });
  }
  return out;
}

export function mapImapAttachmentsForMessage(params: {
  restaurantId: string;
  uid: number;
  parsed: ImapParsedAttachment[];
}): ContactMessageAttachment[] {
  return params.parsed.map((a) => ({
    id: String(a.index),
    kind: attachmentKindFromMime(a.mimeType),
    fileName: a.fileName,
    mimeType: a.mimeType,
    byteSize: a.byteSize,
    url: emailAttachmentProxyUrl({
      restaurantId: params.restaurantId,
      uid: params.uid,
      index: a.index,
    }),
  }));
}
