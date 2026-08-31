import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  RestaurantStaffConversationRow,
  RestaurantStaffMessageRow,
} from "@/lib/types/staff-messages";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { staffDisplayName, type RestaurantStaffRow } from "@/lib/types/staff";

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function peerId(
  conversation: {
    participant_a: string;
    participant_b: string;
  },
  selfId: string,
): string {
  return conversation.participant_a === selfId
    ? conversation.participant_b
    : conversation.participant_a;
}

function staffNameByProfile(
  staff: RestaurantStaffRow[],
  profileId: string,
): string {
  const row = staff.find((s) => s.profile_id === profileId);
  if (row) return staffDisplayName(row);
  return "Kollege";
}

export async function fetchStaffConversationsForRestaurant(params: {
  restaurantId: string;
  profileId: string;
  staff: RestaurantStaffRow[];
}): Promise<{ data: RestaurantStaffConversationRow[]; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_staff_conversations")
    .select(
      `
      id,
      restaurant_id,
      participant_a,
      participant_b,
      last_message_at,
      last_message_preview,
      last_sender_profile_id,
      created_at,
      updated_at
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .or(
      `participant_a.eq.${params.profileId},participant_b.eq.${params.profileId}`,
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) return { data: [], error: error.message };

  const conversations = (data ?? []) as Omit<
    RestaurantStaffConversationRow,
    "peer_profile_id" | "peer_name" | "is_unread"
  >[];

  const ids = conversations.map((c) => c.id);
  const reads = new Map<string, string>();
  if (ids.length > 0) {
    const { data: readRows } = await sb
      .from("restaurant_staff_conversation_reads")
      .select("conversation_id, last_read_at")
      .eq("profile_id", params.profileId)
      .in("conversation_id", ids);
    for (const row of readRows ?? []) {
      const r = row as { conversation_id: string; last_read_at: string };
      reads.set(r.conversation_id, r.last_read_at);
    }
  }

  return {
    data: conversations.map((c) => {
      const peer = peerId(c, params.profileId);
      const lastRead = reads.get(c.id);
      const is_unread = Boolean(
        c.last_message_at &&
          c.last_sender_profile_id &&
          c.last_sender_profile_id !== params.profileId &&
          (!lastRead || lastRead < c.last_message_at),
      );
      return {
        ...c,
        peer_profile_id: peer,
        peer_name: staffNameByProfile(params.staff, peer),
        is_unread,
      };
    }),
    error: null,
  };
}

export async function ensureStaffConversation(params: {
  restaurantId: string;
  selfProfileId: string;
  peerProfileId: string;
}): Promise<{ data: string | null; error: string | null }> {
  if (params.selfProfileId === params.peerProfileId) {
    return { data: null, error: "Kein Chat mit sich selbst" };
  }
  const [a, b] = orderedPair(params.selfProfileId, params.peerProfileId);
  const sb = createSupabaseBrowserClient();

  const { data: existing, error: findErr } = await sb
    .from("restaurant_staff_conversations")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  if (findErr) return { data: null, error: findErr.message };
  if (existing?.id) return { data: existing.id as string, error: null };

  const { data: created, error: insertErr } = await sb
    .from("restaurant_staff_conversations")
    .insert({
      restaurant_id: params.restaurantId,
      participant_a: a,
      participant_b: b,
    })
    .select("id")
    .single();

  if (insertErr) {
    // Race: parallel insert — erneut lesen
    const { data: again } = await sb
      .from("restaurant_staff_conversations")
      .select("id")
      .eq("restaurant_id", params.restaurantId)
      .eq("participant_a", a)
      .eq("participant_b", b)
      .maybeSingle();
    if (again?.id) return { data: again.id as string, error: null };
    return { data: null, error: insertErr.message };
  }

  return { data: created.id as string, error: null };
}

export async function fetchStaffMessages(params: {
  conversationId: string;
  limit?: number;
}): Promise<{ data: RestaurantStaffMessageRow[]; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_staff_messages")
    .select(
      "id, restaurant_id, conversation_id, sender_profile_id, body, created_at",
    )
    .eq("conversation_id", params.conversationId)
    .order("created_at", { ascending: true })
    .limit(params.limit ?? 200);

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as RestaurantStaffMessageRow[], error: null };
}

export async function sendStaffMessage(params: {
  restaurantId: string;
  conversationId: string;
  senderProfileId: string;
  body: string;
}): Promise<{ data: RestaurantStaffMessageRow | null; error: string | null }> {
  const body = params.body.trim();
  if (!body) return { data: null, error: "Nachricht leer" };

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_staff_messages")
    .insert({
      restaurant_id: params.restaurantId,
      conversation_id: params.conversationId,
      sender_profile_id: params.senderProfileId,
      body,
    })
    .select(
      "id, restaurant_id, conversation_id, sender_profile_id, body, created_at",
    )
    .single();

  if (error) return { data: null, error: error.message };

  const preview = body.length > 140 ? `${body.slice(0, 137)}…` : body;
  await sb
    .from("restaurant_staff_conversations")
    .update({
      last_message_at: data.created_at,
      last_message_preview: preview,
      last_sender_profile_id: params.senderProfileId,
    })
    .eq("id", params.conversationId);

  return { data: data as RestaurantStaffMessageRow, error: null };
}

export async function markStaffConversationRead(params: {
  conversationId: string;
  profileId: string;
}): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("restaurant_staff_conversation_reads").upsert(
    {
      conversation_id: params.conversationId,
      profile_id: params.profileId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "conversation_id,profile_id" },
  );
  return { error: error?.message ?? null };
}

export async function countUnreadStaffConversations(params: {
  restaurantId: string;
  profileId: string;
}): Promise<number> {
  const { data } = await fetchStaffConversationsForRestaurant({
    restaurantId: params.restaurantId,
    profileId: params.profileId,
    staff: [],
  });
  return data.filter((c) => c.is_unread).length;
}
