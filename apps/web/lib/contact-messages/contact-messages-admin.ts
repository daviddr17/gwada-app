import "server-only";

import {
  fetchMessageAttachmentsForRestaurant,
  groupAttachmentsByMessageId,
  type RawMessageAttachmentRow,
} from "@/lib/contact-messages/fetch-message-attachments";
import { gwadaAttachmentDownloadUrl } from "@/lib/contact-messages/contact-message-attachment-urls";
import type { ContactMessageAttachment } from "@/lib/types/contact-message-attachment";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const MESSAGE_SELECT = `
  id,
  restaurant_id,
  contact_id,
  platform,
  direction,
  body,
  reservation_id,
  sent_by,
  delivery_status,
  created_at,
  send_batch_id,
  external_source_id
`;

function mapMessageRow(
  raw: Record<string, unknown>,
  attachmentRows: RawMessageAttachmentRow[] = [],
): ContactMessageRow {
  const restaurantId = raw.restaurant_id as string;
  const messageId = raw.id as string;
  const attachments: ContactMessageAttachment[] = attachmentRows.map((a) => ({
    id: a.id,
    kind: a.kind === "image" ? "image" : "file",
    fileName: a.file_name,
    mimeType: a.mime_type,
    byteSize: a.byte_size,
    url: gwadaAttachmentDownloadUrl({
      restaurantId,
      messageId,
      attachmentId: a.id,
    }),
  }));

  return {
    ...(raw as ContactMessageRow),
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/** Server-seitig: neueste N DB-Nachrichten (optional älter als `before`). */
export async function fetchContactMessagesAdmin(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    limit: number;
    before?: string | null;
  },
): Promise<{ data: ContactMessageRow[]; hasMore: boolean; error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.contactId)
  ) {
    return { data: [], hasMore: false, error: null };
  }

  let q = admin
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("contact_id", params.contactId)
    .order("created_at", { ascending: false })
    .limit(params.limit);

  if (params.before) {
    q = q.lt("created_at", params.before);
  }

  const { data, error } = await q;
  if (error) {
    return { data: [], hasMore: false, error: new Error(error.message) };
  }

  const rows = [...((data ?? []) as Record<string, unknown>[])].reverse();
  const hasMore = (data ?? []).length === params.limit;

  if (rows.length === 0) {
    return { data: [], hasMore: false, error: null };
  }

  const messageIds = rows.map((r) => r.id as string);
  const { data: attachmentRows, error: attErr } =
    await fetchMessageAttachmentsForRestaurant(admin, {
      restaurantId: params.restaurantId,
      messageIds,
    });
  const byMessage = attErr
    ? new Map<string, RawMessageAttachmentRow[]>()
    : groupAttachmentsByMessageId(attachmentRows);

  const enriched = rows.map((row) =>
    mapMessageRow(row, byMessage.get(row.id as string) ?? []),
  );

  return { data: enriched, hasMore, error: null };
}
