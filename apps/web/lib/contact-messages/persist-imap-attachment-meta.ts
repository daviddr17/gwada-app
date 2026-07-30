import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { imapAttachmentStoragePath } from "@/lib/contact-messages/imap-attachment-storage-path";
import { attachmentKindFromMime } from "@/lib/contact-messages/outbound-attachment-files";

export type ImapAttachmentMetaInput = {
  index: number;
  fileName: string;
  mimeType: string;
  byteSize: number | null;
};

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim() || "anhang";
  return base.slice(0, 255);
}

/** Nur Metadaten — kein Upload in contact-message-attachments Bucket. */
export async function persistImapAttachmentMeta(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    messageId: string;
    uid: number;
    attachments: ImapAttachmentMetaInput[];
  },
): Promise<{ error: string | null }> {
  if (params.attachments.length === 0) return { error: null };

  const { data: existing } = await admin
    .from("contact_message_attachments")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("message_id", params.messageId)
    .limit(1);

  if ((existing?.length ?? 0) > 0) return { error: null };

  const rows = params.attachments.map((a) => {
    const mime =
      a.mimeType.split(";")[0]?.trim().slice(0, 127) || "application/octet-stream";
    return {
      id: randomUUID(),
      restaurant_id: params.restaurantId,
      message_id: params.messageId,
      kind: attachmentKindFromMime(mime) === "image" ? "image" : "file",
      file_name: sanitizeFileName(a.fileName),
      mime_type: mime,
      byte_size: a.byteSize,
      storage_path: imapAttachmentStoragePath(params.uid, a.index),
    };
  });

  const { error } = await admin.from("contact_message_attachments").insert(rows);
  if (error) return { error: error.message };
  return { error: null };
}

export async function markContactMessageAttachmentsSynced(
  admin: SupabaseClient,
  params: { restaurantId: string; messageId: string },
): Promise<void> {
  await admin
    .from("contact_messages")
    .update({ external_attachments_synced: true })
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.messageId);
}
