"use client";

import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type FollowUpLite = {
  id: string;
  conversation_key: string;
  reason: string | null;
  remind_at: string | null;
  assigned_staff_id: string | null;
  staff_name: string | null;
};

function staffNameFromJoin(staff: unknown): string | null {
  if (!staff || typeof staff !== "object") return null;
  const row = staff as {
    given_name?: string | null;
    family_name?: string | null;
  };
  const given = row.given_name?.trim() ?? "";
  const family = row.family_name?.trim() ?? "";
  const label = `${given} ${family}`.trim();
  return label || null;
}

export async function enrichConversationsWithFollowUpsClient(params: {
  restaurantId: string;
  conversations: ContactConversationPreview[];
}): Promise<ContactConversationPreview[]> {
  if (params.conversations.length === 0) return params.conversations;

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contact_conversation_follow_ups")
    .select(
      "id, conversation_key, reason, remind_at, assigned_staff_id, restaurant_staff:assigned_staff_id ( given_name, family_name )",
    )
    .eq("restaurant_id", params.restaurantId)
    .is("cleared_at", null);

  if (error || !data?.length) {
    if (error) console.warn("[follow-ups] client list", error.message);
    return params.conversations;
  }

  const rows: FollowUpLite[] = (
    data as Array<{
      id: string;
      conversation_key: string;
      reason: string | null;
      remind_at: string | null;
      assigned_staff_id: string | null;
      restaurant_staff?: unknown;
    }>
  ).map((row) => ({
    id: row.id,
    conversation_key: row.conversation_key,
    reason: row.reason,
    remind_at: row.remind_at,
    assigned_staff_id: row.assigned_staff_id,
    staff_name: staffNameFromJoin(row.restaurant_staff),
  }));

  const byKey = new Map(rows.map((row) => [row.conversation_key, row]));
  return params.conversations.map((c) => {
    const follow = byKey.get(c.contact_id);
    if (!follow) {
      return {
        ...c,
        follow_up_id: null,
        follow_up_reason: null,
        follow_up_remind_at: null,
        follow_up_staff_id: null,
        follow_up_staff_name: null,
      };
    }
    return {
      ...c,
      follow_up_id: follow.id,
      follow_up_reason: follow.reason,
      follow_up_remind_at: follow.remind_at,
      follow_up_staff_id: follow.assigned_staff_id,
      follow_up_staff_name: follow.staff_name,
    };
  });
}
