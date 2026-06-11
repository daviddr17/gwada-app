import "server-only";

import {
  NOTIFICATION_DELIVER_BACKOFF_MS,
  NOTIFICATION_DELIVER_EVENTS_BATCH,
  NOTIFICATION_DELIVER_MAX_ATTEMPTS,
  NOTIFICATION_DELIVER_RATE_PER_SECOND,
  NOTIFICATION_DELIVER_SEND_BATCH,
} from "@/lib/notifications/notification-deliver-constants";
import {
  loadProfilePushContact,
  sendNotificationPushEmail,
  sendNotificationPushWhatsapp,
} from "@/lib/notifications/notification-deliver-send";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import { isNotificationModuleId } from "@/lib/notifications/notification-modules";
import {
  defaultNotificationPreferences,
  isPushModuleEnabled,
  mergeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences";
import { buildNotificationPushText } from "@/lib/notifications/notification-push-message";
import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationEventRow = {
  id: string;
  restaurant_id: string | null;
  module: string;
  reference_id: string;
  payload: Record<string, unknown>;
};

type StaffTarget = {
  profileId: string;
  restaurantId: string;
};

type DeliveryRow = {
  id: string;
  event_id: string;
  profile_id: string;
  context_restaurant_id: string;
  channel: "whatsapp" | "email";
  attempts: number;
  notification_events: NotificationEventRow | NotificationEventRow[] | null;
};

export type NotificationDeliverCronStats = {
  eventsProcessed: number;
  deliveriesCreated: number;
  deliveriesProcessed: number;
  sent: number;
  failed: number;
  skipped: number;
};

function eventFromDeliveryJoin(
  joined: DeliveryRow["notification_events"],
): NotificationEventRow | null {
  if (!joined) return null;
  return Array.isArray(joined) ? (joined[0] ?? null) : joined;
}

function preferencesFromRow(
  raw: Record<string, unknown> | null,
): NotificationPreferences {
  return mergeNotificationPreferences(
    raw as Parameters<typeof mergeNotificationPreferences>[0],
  );
}

async function loadStaffTargetsForEvent(
  admin: SupabaseClient,
  event: NotificationEventRow,
): Promise<StaffTarget[]> {
  if (event.restaurant_id) {
    const { data } = await admin
      .from("restaurant_employees")
      .select("profile_id, restaurant_id")
      .eq("restaurant_id", event.restaurant_id)
      .eq("is_active", true);

    return (data ?? []).map((row) => ({
      profileId: (row as { profile_id: string }).profile_id,
      restaurantId: (row as { restaurant_id: string }).restaurant_id,
    }));
  }

  const { data } = await admin
    .from("restaurant_employees")
    .select("profile_id, restaurant_id")
    .eq("is_active", true);

  return (data ?? []).map((row) => ({
    profileId: (row as { profile_id: string }).profile_id,
    restaurantId: (row as { restaurant_id: string }).restaurant_id,
  }));
}

async function loadPreferencesMap(
  admin: SupabaseClient,
  targets: StaffTarget[],
): Promise<Map<string, NotificationPreferences>> {
  const map = new Map<string, NotificationPreferences>();
  if (targets.length === 0) return map;

  const restaurantIds = [...new Set(targets.map((t) => t.restaurantId))];
  const profileIds = [...new Set(targets.map((t) => t.profileId))];

  const { data } = await admin
    .from("user_restaurant_notification_preferences")
    .select(
      "profile_id, restaurant_id, channel_whatsapp_enabled, channel_email_enabled, in_app_modules, push_whatsapp_modules, push_email_modules",
    )
    .in("restaurant_id", restaurantIds)
    .in("profile_id", profileIds);

  for (const row of data ?? []) {
    const r = row as {
      profile_id: string;
      restaurant_id: string;
    } & Record<string, unknown>;
    map.set(
      `${r.profile_id}:${r.restaurant_id}`,
      preferencesFromRow(r),
    );
  }

  return map;
}

function prefsForTarget(
  map: Map<string, NotificationPreferences>,
  target: StaffTarget,
): NotificationPreferences {
  return (
    map.get(`${target.profileId}:${target.restaurantId}`) ??
    defaultNotificationPreferences()
  );
}

async function fanOutEvent(
  admin: SupabaseClient,
  event: NotificationEventRow,
): Promise<number> {
  if (!isNotificationModuleId(event.module)) {
    return 0;
  }

  const moduleId = event.module as NotificationModuleId;
  const targets = await loadStaffTargetsForEvent(admin, event);
  if (targets.length === 0) return 0;

  const prefsMap = await loadPreferencesMap(admin, targets);
  const rows: {
    event_id: string;
    profile_id: string;
    context_restaurant_id: string;
    channel: "whatsapp" | "email";
    idempotency_key: string;
  }[] = [];

  for (const target of targets) {
    const prefs = prefsForTarget(prefsMap, target);

    if (isPushModuleEnabled(prefs, "whatsapp", moduleId)) {
      rows.push({
        event_id: event.id,
        profile_id: target.profileId,
        context_restaurant_id: target.restaurantId,
        channel: "whatsapp",
        idempotency_key: `${event.id}:${target.profileId}:whatsapp`,
      });
    }

    if (isPushModuleEnabled(prefs, "email", moduleId)) {
      rows.push({
        event_id: event.id,
        profile_id: target.profileId,
        context_restaurant_id: target.restaurantId,
        channel: "email",
        idempotency_key: `${event.id}:${target.profileId}:email`,
      });
    }
  }

  if (rows.length === 0) return 0;

  const { error } = await admin
    .from("notification_deliveries")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });

  if (error) {
    console.warn("[notification-deliver] fan-out", error.message);
    return 0;
  }

  return rows.length;
}

async function processUnprocessedEvents(
  admin: SupabaseClient,
): Promise<{ processed: number; deliveriesCreated: number }> {
  const { data: events, error } = await admin
    .from("notification_events")
    .select("id, restaurant_id, module, reference_id, payload")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(NOTIFICATION_DELIVER_EVENTS_BATCH);

  if (error || !events?.length) {
    return { processed: 0, deliveriesCreated: 0 };
  }

  let deliveriesCreated = 0;
  const now = new Date().toISOString();

  for (const event of events as NotificationEventRow[]) {
    deliveriesCreated += await fanOutEvent(admin, event);
    await admin
      .from("notification_events")
      .update({ processed_at: now })
      .eq("id", event.id)
      .is("processed_at", null);
  }

  return { processed: events.length, deliveriesCreated };
}

async function fetchRestaurantName(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();
  const name = data?.name;
  return typeof name === "string" ? name.trim() || null : null;
}

function backoffMs(attemptsAfterFailure: number): number {
  const index = Math.min(
    attemptsAfterFailure - 1,
    NOTIFICATION_DELIVER_BACKOFF_MS.length - 1,
  );
  return NOTIFICATION_DELIVER_BACKOFF_MS[Math.max(0, index)] ?? 60_000;
}

async function markDeliveryOutcome(
  admin: SupabaseClient,
  delivery: DeliveryRow,
  outcome:
    | { kind: "sent" }
    | { kind: "skip"; error: string }
    | { kind: "retry"; error: string }
    | { kind: "failed"; error: string },
): Promise<"sent" | "failed" | "skipped"> {
  const attempts = delivery.attempts + 1;
  const now = new Date().toISOString();

  if (outcome.kind === "sent") {
    await admin
      .from("notification_deliveries")
      .update({
        status: "sent",
        attempts,
        last_error: null,
        sent_at: now,
      })
      .eq("id", delivery.id);
    return "sent";
  }

  if (outcome.kind === "skip") {
    await admin
      .from("notification_deliveries")
      .update({
        status: "failed",
        attempts,
        last_error: outcome.error,
      })
      .eq("id", delivery.id);
    return "skipped";
  }

  if (outcome.kind === "retry" && attempts < NOTIFICATION_DELIVER_MAX_ATTEMPTS) {
    const scheduledAt = new Date(Date.now() + backoffMs(attempts)).toISOString();
    await admin
      .from("notification_deliveries")
      .update({
        status: "pending",
        attempts,
        last_error: outcome.error,
        scheduled_at: scheduledAt,
      })
      .eq("id", delivery.id);
    return "failed";
  }

  await admin
    .from("notification_deliveries")
    .update({
      status: "failed",
      attempts,
      last_error: outcome.error,
    })
    .eq("id", delivery.id);
  return "failed";
}

async function deliverOne(
  admin: SupabaseClient,
  delivery: DeliveryRow,
  restaurantNames: Map<string, string | null>,
): Promise<"sent" | "failed" | "skipped"> {
  const event = eventFromDeliveryJoin(delivery.notification_events);
  if (!event || !isNotificationModuleId(event.module)) {
    return markDeliveryOutcome(admin, delivery, {
      kind: "skip",
      error: "invalid_event",
    });
  }

  const restaurantName =
    restaurantNames.get(delivery.context_restaurant_id) ?? null;
  const { text, subject } = buildNotificationPushText(
    {
      module: event.module,
      payload: event.payload ?? {},
    },
    restaurantName,
  );

  const contact = await loadProfilePushContact(admin, delivery.profile_id);

  if (delivery.channel === "whatsapp") {
    if (!contact.phone) {
      return markDeliveryOutcome(admin, delivery, {
        kind: "skip",
        error: "no_phone",
      });
    }

    const result = await sendNotificationPushWhatsapp({
      restaurantId: delivery.context_restaurant_id,
      phone: contact.phone,
      text,
    });

    if (result.ok) {
      return markDeliveryOutcome(admin, delivery, { kind: "sent" });
    }

    return markDeliveryOutcome(admin, delivery, {
      kind:
        delivery.attempts + 1 < NOTIFICATION_DELIVER_MAX_ATTEMPTS
          ? "retry"
          : "failed",
      error: result.error,
    });
  }

  if (!contact.email) {
    return markDeliveryOutcome(admin, delivery, {
      kind: "skip",
      error: "no_email",
    });
  }

  const result = await sendNotificationPushEmail({
    restaurantId: delivery.context_restaurant_id,
    to: contact.email,
    subject,
    text,
    admin,
  });

  if (result.ok) {
    return markDeliveryOutcome(admin, delivery, { kind: "sent" });
  }

  return markDeliveryOutcome(admin, delivery, {
    kind:
      delivery.attempts + 1 < NOTIFICATION_DELIVER_MAX_ATTEMPTS
        ? "retry"
        : "failed",
    error: result.error,
  });
}

async function processPendingDeliveries(
  admin: SupabaseClient,
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date().toISOString();
  const { data: due, error } = await admin
    .from("notification_deliveries")
    .select(
      "id, event_id, profile_id, context_restaurant_id, channel, attempts, notification_events ( id, restaurant_id, module, reference_id, payload )",
    )
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(NOTIFICATION_DELIVER_SEND_BATCH);

  if (error || !due?.length) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  const restaurantNames = new Map<string, string | null>();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < due.length; i += 1) {
    const delivery = due[i] as DeliveryRow;
    const restaurantId = delivery.context_restaurant_id;
    if (!restaurantNames.has(restaurantId)) {
      restaurantNames.set(
        restaurantId,
        await fetchRestaurantName(admin, restaurantId),
      );
    }

    const outcome = await deliverOne(admin, delivery, restaurantNames);
    if (outcome === "sent") sent += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;

    if (
      (i + 1) % NOTIFICATION_DELIVER_RATE_PER_SECOND === 0 &&
      i + 1 < due.length
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { processed: due.length, sent, failed, skipped };
}

export async function runNotificationDeliverCron(
  admin: SupabaseClient,
): Promise<NotificationDeliverCronStats> {
  const eventStats = await processUnprocessedEvents(admin);
  const sendStats = await processPendingDeliveries(admin);

  return {
    eventsProcessed: eventStats.processed,
    deliveriesCreated: eventStats.deliveriesCreated,
    deliveriesProcessed: sendStats.processed,
    sent: sendStats.sent,
    failed: sendStats.failed,
    skipped: sendStats.skipped,
  };
}
