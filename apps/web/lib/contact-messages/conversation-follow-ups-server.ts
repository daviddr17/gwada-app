import "server-only";

import { dashboardMessageThreadHref } from "@/lib/contact-messages/messages-unread-summary";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactConversationFollowUpRow = {
  id: string;
  restaurant_id: string;
  conversation_key: string;
  reason: string | null;
  remind_at: string | null;
  reminded_at: string | null;
  assigned_staff_id: string | null;
  staff_todo_id: string | null;
  contact_display_name: string | null;
  created_by: string | null;
  cleared_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactConversationFollowUpWithStaff =
  ContactConversationFollowUpRow & {
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

export async function listActiveFollowUpsForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<ContactConversationFollowUpWithStaff[]> {
  const { data, error } = await admin
    .from("contact_conversation_follow_ups")
    .select(
      "id, restaurant_id, conversation_key, reason, remind_at, reminded_at, assigned_staff_id, staff_todo_id, contact_display_name, created_by, cleared_at, created_at, updated_at, restaurant_staff:assigned_staff_id ( given_name, family_name )",
    )
    .eq("restaurant_id", restaurantId)
    .is("cleared_at", null);

  if (error) {
    console.warn("[follow-ups] list", error.message);
    return [];
  }

  return ((data ?? []) as Array<
    ContactConversationFollowUpRow & {
      restaurant_staff?: unknown;
    }
  >).map((row) => {
    const { restaurant_staff, ...rest } = row;
    return {
      ...rest,
      staff_name: staffNameFromJoin(restaurant_staff),
    };
  });
}

export async function enrichConversationsWithFollowUps(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    conversations: ContactConversationPreview[];
  },
): Promise<ContactConversationPreview[]> {
  if (params.conversations.length === 0) return params.conversations;
  const rows = await listActiveFollowUpsForRestaurant(
    admin,
    params.restaurantId,
  );
  if (rows.length === 0) return params.conversations;

  const byKey = new Map(rows.map((row) => [row.conversation_key, row]));
  return params.conversations.map((c) => {
    const follow = byKey.get(c.contact_id);
    if (!follow) return c;
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

export async function upsertConversationFollowUp(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    contactDisplayName?: string | null;
    reason?: string | null;
    remindAt?: string | null;
    staffId?: string | null;
  },
): Promise<{ data: ContactConversationFollowUpRow | null; error: string | null }> {
  const conversationKey = params.conversationKey.trim();
  if (!conversationKey) {
    return { data: null, error: "invalid_request" };
  }

  const reason = params.reason?.trim() || null;
  if (reason && reason.length > 500) {
    return { data: null, error: "reason_too_long" };
  }

  let remindAt: string | null = null;
  if (params.remindAt?.trim()) {
    const parsed = new Date(params.remindAt.trim());
    if (Number.isNaN(parsed.getTime())) {
      return { data: null, error: "invalid_remind_at" };
    }
    remindAt = parsed.toISOString();
  }

  const staffId = params.staffId?.trim() || null;
  if (staffId) {
    const { data: staffRow, error: staffErr } = await admin
      .from("restaurant_staff")
      .select("id")
      .eq("id", staffId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();
    if (staffErr || !staffRow) {
      return { data: null, error: "invalid_staff" };
    }
  }

  const { data: existing } = await admin
    .from("contact_conversation_follow_ups")
    .select("id, staff_todo_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("conversation_key", conversationKey)
    .is("cleared_at", null)
    .maybeSingle();

  const existingId = (existing as { id: string; staff_todo_id: string | null } | null)
    ?.id;
  let staffTodoId =
    (existing as { staff_todo_id: string | null } | null)?.staff_todo_id ?? null;

  if (staffId) {
    const todoResult = await upsertLinkedStaffTodo(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      conversationKey,
      contactDisplayName: params.contactDisplayName,
      reason,
      remindAt,
      staffId,
      todoId: staffTodoId,
    });
    if (todoResult.error) {
      return { data: null, error: todoResult.error };
    }
    staffTodoId = todoResult.todoId;
  } else if (staffTodoId) {
    await archiveLinkedStaffTodo(admin, {
      restaurantId: params.restaurantId,
      todoId: staffTodoId,
    });
    staffTodoId = null;
  }

  const payload = {
    restaurant_id: params.restaurantId,
    conversation_key: conversationKey,
    reason,
    remind_at: remindAt,
    reminded_at: null,
    assigned_staff_id: staffId,
    staff_todo_id: staffTodoId,
    contact_display_name: params.contactDisplayName?.trim() || null,
    created_by: params.userId,
    cleared_at: null,
  };

  if (existingId) {
    const { data, error } = await admin
      .from("contact_conversation_follow_ups")
      .update(payload)
      .eq("id", existingId)
      .select("*")
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as ContactConversationFollowUpRow, error: null };
  }

  const { data, error } = await admin
    .from("contact_conversation_follow_ups")
    .insert(payload)
    .select("*")
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as ContactConversationFollowUpRow, error: null };
}

export async function clearConversationFollowUp(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    conversationKey: string;
  },
): Promise<{ error: string | null }> {
  const conversationKey = params.conversationKey.trim();
  if (!conversationKey) return { error: "invalid_request" };

  const { data: existing } = await admin
    .from("contact_conversation_follow_ups")
    .select("id, staff_todo_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("conversation_key", conversationKey)
    .is("cleared_at", null)
    .maybeSingle();

  if (!existing) return { error: null };

  const row = existing as { id: string; staff_todo_id: string | null };
  if (row.staff_todo_id) {
    await archiveLinkedStaffTodo(admin, {
      restaurantId: params.restaurantId,
      todoId: row.staff_todo_id,
    });
  }

  const { error } = await admin
    .from("contact_conversation_follow_ups")
    .update({
      cleared_at: new Date().toISOString(),
      staff_todo_id: null,
    })
    .eq("id", row.id);

  return { error: error?.message ?? null };
}

export async function markFollowUpReminderSeen(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    followUpId: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from("contact_conversation_follow_ups")
    .update({ reminded_at: new Date().toISOString() })
    .eq("id", params.followUpId)
    .eq("restaurant_id", params.restaurantId)
    .is("cleared_at", null);
  return { error: error?.message ?? null };
}

async function upsertLinkedStaffTodo(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    conversationKey: string;
    contactDisplayName?: string | null;
    reason: string | null;
    remindAt: string | null;
    staffId: string;
    todoId: string | null;
  },
): Promise<{ todoId: string | null; error: string | null }> {
  const contactLabel =
    params.contactDisplayName?.trim() || "Nachricht";
  const href = dashboardMessageThreadHref(params.conversationKey);
  const descriptionParts = [
    params.reason?.trim() || null,
    `Chat öffnen: ${href}`,
  ].filter(Boolean);

  const payload = {
    restaurant_id: params.restaurantId,
    title: `Nachricht: ${contactLabel}`,
    description: descriptionParts.join("\n\n"),
    assignee_type: "staff" as const,
    staff_id: params.staffId,
    position_tag_id: null,
    priority: "medium" as const,
    display_from: null,
    display_until: params.remindAt,
    show_on_display: true,
    show_before_clock_in: false,
    show_before_break_start: false,
    show_before_break_end: false,
    show_before_clock_out: false,
    show_on_pin_login: false,
    completion_mode: "any_one" as const,
    require_defer_reason: false,
    blocks_shift_end: false,
    allow_reopen_on_display: false,
    sort_order: 0,
    recurrence: "ad_hoc" as const,
    capture_type: "boolean" as const,
    target_min: null,
    target_max: null,
    checklist_device_id: null,
    checklist_area_id: null,
    require_corrective_on_deviation: false,
    archived_at: null,
  };

  let todoId = params.todoId;
  if (todoId) {
    const { error } = await admin
      .from("restaurant_staff_todos")
      .update(payload)
      .eq("id", todoId)
      .eq("restaurant_id", params.restaurantId);
    if (error) return { todoId: null, error: error.message };
  } else {
    const { data, error } = await admin
      .from("restaurant_staff_todos")
      .insert({ ...payload, created_by: params.userId })
      .select("id")
      .single();
    if (error || !data) {
      return { todoId: null, error: error?.message ?? "todo_create_failed" };
    }
    todoId = (data as { id: string }).id;
  }

  await admin
    .from("restaurant_staff_todo_staff_assignees")
    .delete()
    .eq("todo_id", todoId);

  const { error: assigneeErr } = await admin
    .from("restaurant_staff_todo_staff_assignees")
    .insert({ todo_id: todoId, staff_id: params.staffId });
  if (assigneeErr) {
    return { todoId: null, error: assigneeErr.message };
  }

  return { todoId, error: null };
}

async function archiveLinkedStaffTodo(
  admin: SupabaseClient,
  params: { restaurantId: string; todoId: string },
): Promise<void> {
  await admin
    .from("restaurant_staff_todos")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", params.todoId)
    .eq("restaurant_id", params.restaurantId);
}
