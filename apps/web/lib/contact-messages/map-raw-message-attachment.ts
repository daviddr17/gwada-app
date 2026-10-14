import { attachmentUrlFromStoragePath } from "@/lib/contact-messages/contact-message-attachment-urls";
import type { RawMessageAttachmentRow } from "@/lib/contact-messages/fetch-message-attachments";
import { isImapAttachmentStoragePath } from "@/lib/contact-messages/imap-attachment-storage-path";
import { isWahaAttachmentStoragePath } from "@/lib/contact-messages/waha-attachment-storage-path";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";

export function mapRawMessageAttachmentRow(
  a: RawMessageAttachmentRow,
  params: { restaurantId: string; messageId: string },
): ContactMessageAttachment {
  const mime = (a.mime_type ?? "").toLowerCase();
  let kind: ContactMessageAttachment["kind"] =
    a.kind === "image" ? "image" : "file";
  if (mime.startsWith("video/")) kind = "video";
  else if (mime.startsWith("audio/")) kind = "voice";
  else if (a.file_name === "Video") kind = "video";
  else if (a.file_name === "Sprachnachricht") kind = "voice";

  return {
    id: a.id,
    kind,
    fileName: a.file_name,
    mimeType: a.mime_type,
    byteSize: a.byte_size,
    url: attachmentUrlFromStoragePath({
      restaurantId: params.restaurantId,
      messageId: params.messageId,
      attachmentId: a.id,
      storagePath: a.storage_path,
    }),
    ...(isImapAttachmentStoragePath(a.storage_path)
      ? { loadOnClick: true as const }
      : {}),
    ...(isWahaAttachmentStoragePath(a.storage_path) && kind === "file"
      ? { loadOnClick: true as const }
      : {}),
  };
}
