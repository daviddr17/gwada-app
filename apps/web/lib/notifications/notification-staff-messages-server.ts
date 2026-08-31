import "server-only";

import type { NotificationItem } from "@/lib/notifications/notification-types";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import type { SupabaseClient } from "@supabase/supabase-js";

const BELL_ITEMS = 5;

type ConversationRow = {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_profile_id: string | null;
};

export async function loadStaffMessagesNotificationItems(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ items: NotificationItem[]; totalCount: number }> {
  const { data, error } = await admin
    .from("restaurant_staff_conversations")
    .select(
      "id, participant_a, participant_b, last_message_at, last_message_preview, last_sender_profile_id",
    )
    .eq("restaurant_id", params.restaurantId)
    .or(
      `participant_a.eq.${params.userId},participant_b.eq.${params.userId}`,
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(40);

  if (error) {
    console.warn("[notifications] staff_messages", error.message);
    return { items: [], totalCount: 0 };
  }

  const conversations = (data ?? []) as ConversationRow[];
  const ids = conversations.map((c) => c.id);
  const reads = new Map<string, string>();
  if (ids.length > 0) {
    const { data: readRows } = await admin
      .from("restaurant_staff_conversation_reads")
      .select("conversation_id, last_read_at")
      .eq("profile_id", params.userId)
      .in("conversation_id", ids);
    for (const row of readRows ?? []) {
      const r = row as { conversation_id: string; last_read_at: string };
      reads.set(r.conversation_id, r.last_read_at);
    }
  }

  const unread = conversations.filter((c) => {
    if (!c.last_message_at || !c.last_sender_profile_id) return false;
    if (c.last_sender_profile_id === params.userId) return false;
    const lastRead = reads.get(c.id);
    return !lastRead || lastRead < c.last_message_at;
  });

  const peerIds = [
    ...new Set(
      unread.map((c) =>
        c.participant_a === params.userId ? c.participant_b : c.participant_a,
      ),
    ),
  ];
  const nameByProfile = new Map<string, string>();
  if (peerIds.length > 0) {
    const { data: staffRows } = await admin
      .from("restaurant_staff")
      .select("profile_id, given_name, family_name")
      .eq("restaurant_id", params.restaurantId)
      .in("profile_id", peerIds);
    for (const row of staffRows ?? []) {
      const r = row as {
        profile_id: string | null;
        given_name: string;
        family_name: string | null;
      };
      if (!r.profile_id) continue;
      nameByProfile.set(
        r.profile_id,
        [r.given_name, r.family_name].filter(Boolean).join(" ").trim() ||
          "Kollege",
      );
    }
  }

  return {
    totalCount: unread.length,
    items: unread.slice(0, BELL_ITEMS).map((c) => {
      const peer =
        c.participant_a === params.userId ? c.participant_b : c.participant_a;
      return {
        id: c.id,
        title: nameByProfile.get(peer) ?? "Kollege",
        subtitle: c.last_message_preview || "Neue Nachricht",
        href: `${NOTIFICATION_MODULES.staff_messages.href}?c=${encodeURIComponent(c.id)}`,
        at: c.last_message_at!,
      };
    }),
  };
}

export async function markStaffMessageConversationReadServer(
  admin: SupabaseClient,
  params: { conversationId: string; userId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin
    .from("restaurant_staff_conversation_reads")
    .upsert(
      {
        conversation_id: params.conversationId,
        profile_id: params.userId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id,profile_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAllStaffMessageConversationsReadServer(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await admin
    .from("restaurant_staff_conversations")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .or(
      `participant_a.eq.${params.userId},participant_b.eq.${params.userId}`,
    );
  if (error) return { ok: false, error: error.message };

  const now = new Date().toISOString();
  const rows = ((data ?? []) as { id: string }[]).map((c) => ({
    conversation_id: c.id,
    profile_id: params.userId,
    last_read_at: now,
  }));
  if (rows.length === 0) return { ok: true };

  const { error: upsertErr } = await admin
    .from("restaurant_staff_conversation_reads")
    .upsert(rows, { onConflict: "conversation_id,profile_id" });
  if (upsertErr) return { ok: false, error: upsertErr.message };
  return { ok: true };
}
