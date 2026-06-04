import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT_MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/constants/contact-message-attachments";
import {
  attachmentKindFromMime,
  type OutboundAttachmentFile,
} from "@/lib/contact-messages/outbound-attachment-files";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";
import { gwadaAttachmentDownloadUrl } from "@/lib/contact-messages/contact-message-attachment-urls";

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim() || "anhang";
  return base.slice(0, 180);
}

export async function storeGwadaMessageAttachments(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    messageId: string;
    files: OutboundAttachmentFile[];
  },
): Promise<{ error: string | null }> {
  for (const file of params.files) {
    const attachmentId = randomUUID();
    const storagePath = `${params.restaurantId}/${params.messageId}/${attachmentId}_${sanitizeFileName(file.fileName)}`;
    const { error: upErr } = await admin.storage
      .from(CONTACT_MESSAGE_ATTACHMENTS_BUCKET)
      .upload(storagePath, file.bytes, {
        contentType: file.mimeType,
        upsert: false,
      });
    if (upErr) return { error: upErr.message };

    const { error: insErr } = await admin.from("contact_message_attachments").insert({
      id: attachmentId,
      restaurant_id: params.restaurantId,
      message_id: params.messageId,
      kind: attachmentKindFromMime(file.mimeType),
      file_name: file.fileName,
      mime_type: file.mimeType,
      byte_size: file.bytes.length,
      storage_path: storagePath,
    });
    if (insErr) return { error: insErr.message };
  }
  return { error: null };
}

type AttachmentRow = {
  id: string;
  kind: string;
  file_name: string;
  mime_type: string;
  byte_size: number | null;
  message_id: string;
};

export function mapGwadaAttachmentRows(
  rows: AttachmentRow[],
  restaurantId: string,
): ContactMessageAttachment[] {
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind === "image" ? "image" : "file",
    fileName: r.file_name,
    mimeType: r.mime_type,
    byteSize: r.byte_size,
    url: gwadaAttachmentDownloadUrl({
      restaurantId,
      messageId: r.message_id,
      attachmentId: r.id,
    }),
  }));
}

export async function fetchGwadaAttachmentsByMessageIds(
  admin: SupabaseClient,
  restaurantId: string,
  messageIds: string[],
): Promise<Map<string, ContactMessageAttachment[]>> {
  const map = new Map<string, ContactMessageAttachment[]>();
  if (messageIds.length === 0) return map;

  const { data, error } = await admin
    .from("contact_message_attachments")
    .select("id, kind, file_name, mime_type, byte_size, message_id")
    .eq("restaurant_id", restaurantId)
    .in("message_id", messageIds);

  if (error || !data) return map;

  for (const row of data as AttachmentRow[]) {
    const list = map.get(row.message_id) ?? [];
    list.push(
      ...mapGwadaAttachmentRows([row], restaurantId),
    );
    map.set(row.message_id, list);
  }
  return map;
}
