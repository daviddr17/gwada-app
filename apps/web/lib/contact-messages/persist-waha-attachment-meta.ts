import "server-only";

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { wahaAttachmentStoragePath } from "@/lib/contact-messages/waha-attachment-storage-path";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim() || "anhang";
  return base.slice(0, 255);
}

function dbKindAndMeta(kind: ContactMessageAttachmentKind): {
  kind: "image" | "file";
  fileName: string;
  mimeType: string;
} {
  if (kind === "image") {
    return { kind: "image", fileName: "Bild", mimeType: "image/jpeg" };
  }
  if (kind === "video") {
    return { kind: "file", fileName: "Video", mimeType: "video/mp4" };
  }
  if (kind === "voice") {
    return {
      kind: "file",
      fileName: "Sprachnachricht",
      mimeType: "audio/ogg; codecs=opus",
    };
  }
  return {
    kind: "file",
    fileName: "Datei",
    mimeType: "application/octet-stream",
  };
}

/**
 * Leichte Anhang-Metadaten für WAHA-Medien (Bild+Caption u. a.),
 * damit die Bubble Caption + Media-Proxy zeigt — ohne Bucket-Upload.
 */
export async function persistWahaAttachmentMeta(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    messageId: string;
    chatId: string;
    wahaMessageId: string;
    mediaKind: ContactMessageAttachmentKind;
  },
): Promise<{ error: string | null }> {
  const chatId = params.chatId.trim();
  const wahaMessageId = params.wahaMessageId.trim();
  if (!chatId || !wahaMessageId) return { error: null };

  const { data: existing } = await admin
    .from("contact_message_attachments")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("message_id", params.messageId)
    .limit(1);

  if ((existing?.length ?? 0) > 0) return { error: null };

  const meta = dbKindAndMeta(params.mediaKind);
  const { error } = await admin.from("contact_message_attachments").insert({
    id: randomUUID(),
    restaurant_id: params.restaurantId,
    message_id: params.messageId,
    kind: meta.kind,
    file_name: sanitizeFileName(meta.fileName),
    mime_type: meta.mimeType.slice(0, 127),
    byte_size: null,
    storage_path: wahaAttachmentStoragePath(chatId, wahaMessageId),
  });

  if (error) return { error: error.message };
  return { error: null };
}
