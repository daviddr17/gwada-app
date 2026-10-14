import "server-only";

import {
  fetchMessageAttachmentsForRestaurant,
  groupAttachmentsByMessageId,
  type RawMessageAttachmentRow,
} from "@/lib/contact-messages/fetch-message-attachments";
import { mapRawMessageAttachmentRow } from "@/lib/contact-messages/map-raw-message-attachment";
import {
  conversationThreadKeyFromRow,
  resolveConversationThreadRef,
} from "@/lib/contact-messages/conversation-thread-key";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const MESSAGE_SELECT = `
  id,
  restaurant_id,
  contact_id,
  conversation_key,
  conversation_label,
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
  const attachments = attachmentRows.map((a) =>
    mapRawMessageAttachmentRow(a, { restaurantId, messageId }),
  );

  return {
    ...(raw as ContactMessageRow),
    contact_id: conversationThreadKeyFromRow({
      contact_id: raw.contact_id as string | null,
      conversation_key: raw.conversation_key as string | null,
    }),
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/** Server-seitig: neueste N DB-Nachrichten (optional älter als `before`). */
export async function fetchContactMessagesAdmin(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    /** UUID oder Pseudo-Thread (waha:/email:/meta:). */
    threadKey: string;
    limit: number;
    before?: string | null;
  },
): Promise<{ data: ContactMessageRow[]; hasMore: boolean; error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: [], hasMore: false, error: null };
  }

  const thread = resolveConversationThreadRef(params.threadKey);
  if (!thread.contactId && !thread.conversationKey) {
    return { data: [], hasMore: false, error: null };
  }

  let q = admin
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .order("created_at", { ascending: false })
    .limit(params.limit);

  if (thread.contactId) {
    q = q.eq("contact_id", thread.contactId);
  } else {
    q = q.eq("conversation_key", thread.conversationKey!);
  }

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
