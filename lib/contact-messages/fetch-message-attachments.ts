import type { SupabaseClient } from "@supabase/supabase-js";

/** Anhänge direkt per Tabelle — kein PostgREST-Embed (schema cache). */
export type RawMessageAttachmentRow = {
  id: string;
  message_id: string;
  kind: string;
  file_name: string;
  mime_type: string;
  byte_size: number | null;
};

export async function fetchMessageAttachmentsForRestaurant(
  client: SupabaseClient,
  params: {
    restaurantId: string;
    messageIds?: string[];
  },
): Promise<{ data: RawMessageAttachmentRow[]; error: Error | null }> {
  let q = client
    .from("contact_message_attachments")
    .select("id, message_id, kind, file_name, mime_type, byte_size")
    .eq("restaurant_id", params.restaurantId);

  if (params.messageIds && params.messageIds.length > 0) {
    q = q.in("message_id", params.messageIds);
  }

  const { data, error } = await q;
  if (error) {
    return { data: [], error: new Error(error.message) };
  }
  return { data: (data ?? []) as RawMessageAttachmentRow[], error: null };
}

export function groupAttachmentsByMessageId(
  rows: RawMessageAttachmentRow[],
): Map<string, RawMessageAttachmentRow[]> {
  const map = new Map<string, RawMessageAttachmentRow[]>();
  for (const row of rows) {
    const list = map.get(row.message_id) ?? [];
    list.push(row);
    map.set(row.message_id, list);
  }
  return map;
}
