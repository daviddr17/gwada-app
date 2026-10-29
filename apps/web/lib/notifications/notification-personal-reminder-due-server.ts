import "server-only";

import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import { scheduleDeliverForNotificationReferences } from "@/lib/notifications/schedule-notification-deliver";
import { filterPersonalReminderPushTargets } from "@/lib/notifications/notification-personal-reminder-targets";
import type { SupabaseClient } from "@supabase/supabase-js";

export { filterPersonalReminderPushTargets };

const DUE_PERSONAL_REMINDER_EMIT_LIMIT = 80;

export type DuePersonalReminderNotifyCronStats = {
  scanned: number;
  emitted: number;
  skippedExisting: number;
  errors: number;
};

/**
 * Fällige persönliche Erinnerungen → notification_events (WhatsApp/E-Mail-Push).
 * Glocke/Popup bleiben unabhängig über Summary bzw. Client-Watcher.
 * Fan-out nur an `targetProfileId` (Notiz-Eigentümer).
 */
export async function emitDuePersonalReminderPushEvents(
  admin: SupabaseClient,
): Promise<DuePersonalReminderNotifyCronStats> {
  const stats: DuePersonalReminderNotifyCronStats = {
    scanned: 0,
    emitted: 0,
    skippedExisting: 0,
    errors: 0,
  };

  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("restaurant_personal_notes")
    .select("id, restaurant_id, profile_id, title, body, remind_at")
    .is("archived_at", null)
    .is("completed_at", null)
    .is("reminded_at", null)
    .not("remind_at", "is", null)
    .lte("remind_at", nowIso)
    .order("remind_at", { ascending: true })
    .limit(DUE_PERSONAL_REMINDER_EMIT_LIMIT);

  if (error) {
    console.warn("[personal-reminder-notify] due query", error.message);
    stats.errors += 1;
    return stats;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    restaurant_id: string;
    profile_id: string;
    title: string;
    body: string | null;
    remind_at: string;
  }>;

  stats.scanned = rows.length;
  const emittedByRestaurant = new Map<string, string[]>();
  const href = NOTIFICATION_MODULES.personal_reminder.href;

  for (const row of rows) {
    const referenceId = `${row.id}:${row.remind_at}`;
    const { data: existing } = await admin
      .from("notification_events")
      .select("id")
      .eq("module", "personal_reminder")
      .eq("reference_id", referenceId)
      .eq("restaurant_id", row.restaurant_id)
      .maybeSingle();

    if (existing) {
      stats.skippedExisting += 1;
      continue;
    }

    const { error: insertErr } = await admin.from("notification_events").insert({
      restaurant_id: row.restaurant_id,
      module: "personal_reminder",
      reference_id: referenceId,
      payload: {
        noteId: row.id,
        title: row.title,
        body: row.body?.trim() || null,
        remindAt: row.remind_at,
        targetProfileId: row.profile_id,
        href,
      },
    });

    if (insertErr) {
      console.warn("[personal-reminder-notify] emit", insertErr.message);
      stats.errors += 1;
      continue;
    }

    stats.emitted += 1;
    const list = emittedByRestaurant.get(row.restaurant_id) ?? [];
    list.push(referenceId);
    emittedByRestaurant.set(row.restaurant_id, list);
  }

  for (const [restaurantId, referenceIds] of emittedByRestaurant) {
    await scheduleDeliverForNotificationReferences(admin, {
      restaurantId,
      module: "personal_reminder",
      referenceIds,
    });
  }

  return stats;
}
