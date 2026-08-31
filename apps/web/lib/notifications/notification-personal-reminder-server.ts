import "server-only";

import type { NotificationItem } from "@/lib/notifications/notification-types";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import type { SupabaseClient } from "@supabase/supabase-js";

const BELL_ITEMS = 5;

export async function loadPersonalReminderNotificationItems(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ items: NotificationItem[]; totalCount: number }> {
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("restaurant_personal_notes")
    .select("id, title, body, remind_at")
    .eq("restaurant_id", params.restaurantId)
    .eq("profile_id", params.userId)
    .is("archived_at", null)
    .is("completed_at", null)
    .not("remind_at", "is", null)
    .lte("remind_at", nowIso)
    .is("reminded_at", null)
    .order("remind_at", { ascending: true })
    .limit(20);

  if (error) {
    console.warn("[notifications] personal_reminder", error.message);
    return { items: [], totalCount: 0 };
  }

  const rows = (data ?? []) as {
    id: string;
    title: string;
    body: string | null;
    remind_at: string;
  }[];

  return {
    totalCount: rows.length,
    items: rows.slice(0, BELL_ITEMS).map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.body?.trim() || "Persönliche Erinnerung",
      href: NOTIFICATION_MODULES.personal_reminder.href,
      at: row.remind_at,
    })),
  };
}

export async function markPersonalReminderSeen(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string; noteId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin
    .from("restaurant_personal_notes")
    .update({ reminded_at: new Date().toISOString() })
    .eq("id", params.noteId)
    .eq("restaurant_id", params.restaurantId)
    .eq("profile_id", params.userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markAllPersonalRemindersSeen(
  admin: SupabaseClient,
  params: { restaurantId: string; userId: string },
): Promise<{ ok: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("restaurant_personal_notes")
    .update({ reminded_at: nowIso })
    .eq("restaurant_id", params.restaurantId)
    .eq("profile_id", params.userId)
    .is("archived_at", null)
    .is("completed_at", null)
    .not("remind_at", "is", null)
    .lte("remind_at", nowIso)
    .is("reminded_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
