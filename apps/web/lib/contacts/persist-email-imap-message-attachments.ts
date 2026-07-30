import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  markContactMessageAttachmentsSynced,
  persistImapAttachmentMeta,
  type ImapAttachmentMetaInput,
} from "@/lib/contact-messages/persist-imap-attachment-meta";
import { attachmentKindFromMime } from "@/lib/contact-messages/outbound-attachment-files";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

export const EMAIL_IMAP_EXTERNAL_PREFIX = "email-imap:";

export function emailImapUidFromExternalSourceId(
  externalSourceId: string | null | undefined,
): number | null {
  const ext = externalSourceId?.trim() ?? "";
  if (!ext.startsWith(EMAIL_IMAP_EXTERNAL_PREFIX)) return null;
  const n = Number.parseInt(ext.slice(EMAIL_IMAP_EXTERNAL_PREFIX.length), 10);
  return Number.isFinite(n) ? n : null;
}

export function attachmentKindFromImapMeta(
  attachments: ImapAttachmentMetaInput[],
): ContactMessageAttachmentKind | null {
  if (attachments.length === 0) return null;
  if (attachments.some((a) => attachmentKindFromMime(a.mimeType) === "image")) {
    return "image";
  }
  return "file";
}

/** Metadaten speichern + synced-Flag setzen (Bytes bleiben im Postfach). */
export async function persistEmailImapMessageAttachments(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    messageId: string;
    uid: number;
    attachments: ImapAttachmentMetaInput[];
  },
): Promise<void> {
  await persistImapAttachmentMeta(admin, params);
  await markContactMessageAttachmentsSynced(admin, {
    restaurantId: params.restaurantId,
    messageId: params.messageId,
  });
}
