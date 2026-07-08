import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { ConversationReadRow } from "@/lib/contact-messages/conversation-read-state";
import {
  conversationReadLookupKey,
} from "@/lib/contact-messages/conversation-read-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const SELECT = `
  conversation_key,
  platform,
  last_read_at,
  marked_unread_at
`;

export type CommunalConversationReadMap = Map<string, string>;

function communalMapFromRows(
  rows: Array<{
    conversation_key: string;
    platform: string;
    communal_last_read_at: string;
  }>,
): CommunalConversationReadMap {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(
      conversationReadLookupKey(
        row.conversation_key,
        row.platform as ContactMessagePlatform,
      ),
      row.communal_last_read_at,
    );
  }
  return map;
}

/** Server/Admin: max last_read_at pro Konversation über alle Mitarbeiter. */
export async function fetchCommunalConversationReadsAdmin(
  sb: SupabaseClient,
  params: { restaurantId: string },
): Promise<CommunalConversationReadMap> {
  const map = new Map<string, string>();
  if (!isUuidRestaurantId(params.restaurantId)) return map;

  const { data, error } = await sb
    .from("contact_conversation_reads")
    .select("conversation_key, platform, last_read_at")
    .eq("restaurant_id", params.restaurantId)
    .not("last_read_at", "is", null);

  if (error) return map;

  for (const raw of data ?? []) {
    const row = raw as {
      conversation_key: string;
      platform: ContactMessagePlatform;
      last_read_at: string;
    };
    const key = conversationReadLookupKey(row.conversation_key, row.platform);
    const existing = map.get(key);
    if (
      !existing ||
      new Date(row.last_read_at).getTime() > new Date(existing).getTime()
    ) {
      map.set(key, row.last_read_at);
    }
  }

  return map;
}

/** Browser: Team-Gelesen via RPC (RLS erlaubt nur eigene Zeilen). */
export async function fetchCommunalConversationReadsBrowser(params: {
  restaurantId: string;
}): Promise<CommunalConversationReadMap> {
  const map = new Map<string, string>();
  if (!isUuidRestaurantId(params.restaurantId)) return map;

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb.rpc("communal_conversation_reads", {
    p_restaurant_id: params.restaurantId,
  });

  if (error) return map;
  return communalMapFromRows(
    (data ?? []) as Array<{
      conversation_key: string;
      platform: string;
      communal_last_read_at: string;
    }>,
  );
}

export function communalReadAtForConversation(
  communalReads: CommunalConversationReadMap,
  conversationKey: string,
  platform: ContactMessagePlatform,
): string | null {
  return communalReads.get(conversationReadLookupKey(conversationKey, platform)) ?? null;
}

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
