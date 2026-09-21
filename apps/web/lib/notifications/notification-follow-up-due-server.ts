import "server-only";

import { dashboardMessageThreadHref } from "@/lib/contact-messages/messages-unread-summary";
import { scheduleDeliverForNotificationReferences } from "@/lib/notifications/schedule-notification-deliver";
import type { SupabaseClient } from "@supabase/supabase-js";

const DUE_FOLLOW_UP_EMIT_LIMIT = 80;

export type DueFollowUpNotifyCronStats = {
  scanned: number;
  emitted: number;
  skippedExisting: number;
  errors: number;
};

/**
 * Fällige Später-Erinnerungen mit WhatsApp-/E-Mail-Opt-in → notification_events.
 * Glocke bleibt unabhängig über Summary; Push nur wenn Kanäle am Follow-up an sind.
 */
export async function emitDueFollowUpPushEvents(
  admin: SupabaseClient,
): Promise<DueFollowUpNotifyCronStats> {
  const stats: DueFollowUpNotifyCronStats = {
    scanned: 0,
    emitted: 0,
    skippedExisting: 0,
    errors: 0,
  };

  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("contact_conversation_follow_ups")
    .select(
      "id, restaurant_id, conversation_key, reason, remind_at, notify_whatsapp, notify_email, contact_display_name, assigned_staff_id",
    )
    .is("cleared_at", null)
    .not("remind_at", "is", null)
    .lte("remind_at", nowIso)
    .or("notify_whatsapp.eq.true,notify_email.eq.true")
    .order("remind_at", { ascending: true })
    .limit(DUE_FOLLOW_UP_EMIT_LIMIT);

  if (error) {
    console.warn("[follow-up-notify] due query", error.message);
    stats.errors += 1;
    return stats;
  }

  const rows = (data ?? []) as Array<{
    id: string;
    restaurant_id: string;
    conversation_key: string;
    reason: string | null;
    remind_at: string;
    notify_whatsapp: boolean;
    notify_email: boolean;
    contact_display_name: string | null;
    assigned_staff_id: string | null;
  }>;

  stats.scanned = rows.length;
  const emittedByRestaurant = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.notify_whatsapp && !row.notify_email) continue;
    const referenceId = `${row.id}:${row.remind_at}`;
    const { data: existing } = await admin
      .from("notification_events")
      .select("id")
      .eq("module", "messages_follow_up")
      .eq("reference_id", referenceId)
      .eq("restaurant_id", row.restaurant_id)
      .maybeSingle();

    if (existing) {
      stats.skippedExisting += 1;
      continue;
    }

    const href = dashboardMessageThreadHref(row.conversation_key);
    const { error: insertErr } = await admin.from("notification_events").insert({
      restaurant_id: row.restaurant_id,
      module: "messages_follow_up",
      reference_id: referenceId,
      payload: {
        followUpId: row.id,
        contactId: row.conversation_key,
        contactName: row.contact_display_name?.trim() || "Nachricht",
        reason: row.reason?.trim() || null,
        remindAt: row.remind_at,
        assignedStaffId: row.assigned_staff_id,
        notifyWhatsapp: row.notify_whatsapp === true,
        notifyEmail: row.notify_email === true,
        href,
      },
    });

    if (insertErr) {
      console.warn("[follow-up-notify] emit", insertErr.message);
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
      module: "messages_follow_up",
      referenceIds,
    });
  }

  return stats;
}
