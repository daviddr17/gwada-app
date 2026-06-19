import "server-only";

import { buildContactConversationsFromRows } from "@/lib/contact-messages/build-contact-conversations";
import { CONVERSATION_LIST_MESSAGE_ROW_LIMIT } from "@/lib/contact-messages/conversation-list-limits";
import {
  fetchMessageAttachmentsForRestaurant,
  groupAttachmentsByMessageId,
} from "@/lib/contact-messages/fetch-message-attachments";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
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
  external_source_id,
  external_seen
`;

/** Server: Konversationsliste einer Plattform aus contact_messages (DB-only). */
export async function fetchContactConversationsAdmin(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    platform: ContactMessagePlatform;
    /** Glocken-/Dashboard-Pfad: ohne Attachment-Join. */
    light?: boolean;
  },
): Promise<ContactConversationPreview[]> {
  if (!isUuidRestaurantId(params.restaurantId)) return [];

  const { data: messages, error } = await admin
    .from("contact_messages")
    .select(
      `
      ${MESSAGE_SELECT},
      contacts ( first_name, last_name )
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", params.platform)
    .order("created_at", { ascending: false })
    .limit(CONVERSATION_LIST_MESSAGE_ROW_LIMIT);

  if (error) {
    console.warn("[contact-inbox] conversations admin", error.message);
    return [];
  }

  const rawRows = (messages ?? []) as Record<string, unknown>[];
  let attachmentsByMessage = new Map<
    string,
    import("@/lib/contact-messages/fetch-message-attachments").RawMessageAttachmentRow[]
  >();

  if (!params.light && rawRows.length > 0) {
    const { data: attachmentRows, error: attErr } =
      await fetchMessageAttachmentsForRestaurant(admin, {
        restaurantId: params.restaurantId,
        messageIds: rawRows.map((r) => r.id as string),
      });
    attachmentsByMessage = attErr
      ? new Map()
      : groupAttachmentsByMessageId(attachmentRows);
  }

  return buildContactConversationsFromRows({
    platform: params.platform,
    rows: rawRows,
    attachmentsByMessage,
  });
}
