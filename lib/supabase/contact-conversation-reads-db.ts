import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ConversationReadRow } from "@/lib/contact-messages/conversation-read-state";
import { conversationReadLookupKey } from "@/lib/contact-messages/conversation-read-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const SELECT = `
  conversation_key,
  platform,
  last_read_at,
  marked_unread_at
`;

export async function fetchConversationReadsForUser(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    platform?: ContactMessagePlatform;
  },
): Promise<Map<string, ConversationReadRow>> {
  const map = new Map<string, ConversationReadRow>();
  if (!isUuidRestaurantId(params.restaurantId)) return map;

  let q = sb
    .from("contact_conversation_reads")
    .select(SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("user_id", params.userId);

  if (params.platform) {
    q = q.eq("platform", params.platform);
  }

  const { data, error } = await q;
  if (error) return map;

  for (const raw of data ?? []) {
    const row = raw as ConversationReadRow;
    map.set(
      conversationReadLookupKey(row.conversation_key, row.platform),
      row,
    );
  }
  return map;
}

export async function fetchConversationReadsBrowser(params: {
  restaurantId: string;
  userId: string;
  platform?: ContactMessagePlatform;
}): Promise<Map<string, ConversationReadRow>> {
  const sb = createSupabaseBrowserClient();
  return fetchConversationReadsForUser(sb, params);
}

export async function upsertConversationRead(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    platform: ContactMessagePlatform;
    lastReadAt?: string | null;
    markedUnreadAt?: string | null;
  },
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {
    restaurant_id: params.restaurantId,
    user_id: params.userId,
    conversation_key: params.conversationKey,
    platform: params.platform,
  };
  if (params.lastReadAt !== undefined) {
    patch.last_read_at = params.lastReadAt;
  }
  if (params.markedUnreadAt !== undefined) {
    patch.marked_unread_at = params.markedUnreadAt;
  }

  const { error } = await sb.from("contact_conversation_reads").upsert(patch, {
    onConflict: "restaurant_id,user_id,conversation_key,platform",
  });

  return { error: error?.message ?? null };
}
