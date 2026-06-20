import "server-only";

import {
  NOTIFICATION_DELIVER_BACKOFF_MS,
  NOTIFICATION_DELIVER_EVENTS_BATCH,
  NOTIFICATION_DELIVER_MAX_ATTEMPTS,
  NOTIFICATION_DELIVER_MAX_LOOP_ITERATIONS,
  NOTIFICATION_DELIVER_RATE_PER_SECOND,
  NOTIFICATION_DELIVER_RUN_BUDGET_MS,
  NOTIFICATION_DELIVER_SEND_BATCH,
} from "@/lib/notifications/notification-deliver-constants";
import {
  loadProfilePushContact,
  sendNotificationPushEmail,
  sendNotificationPushWhatsapp,
} from "@/lib/notifications/notification-deliver-send";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import { isNotificationModuleId } from "@/lib/notifications/notification-modules";
import { filterStaffTodoPushTargets } from "@/lib/notifications/notification-staff-todos-server";
import {
  defaultNotificationPreferences,
  isPushModuleEnabled,
  mergeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences";
import {
  claimNotificationDeliveries,
  claimNotificationDeliveriesForEvent,
  claimNotificationEventById,
  claimUnprocessedNotificationEvents,
  completeNotificationEventProcessing,
  releaseNotificationEventLock,
  releaseStaleNotificationDeliveries,
  releaseStaleNotificationEventLocks,
  type ClaimedNotificationDelivery,
} from "@/lib/notifications/notification-deliver-claim";
import { buildNotificationPushText } from "@/lib/notifications/notification-push-message";
import { actorProfileIdFromPayload } from "@/lib/notifications/notification-self-origin";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Budget für Sofort-Zustellung eines einzelnen Events (Webhook-Pfad). */
export const NOTIFICATION_IMMEDIATE_DELIVER_BUDGET_MS = 60_000;

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

type DeliveryRow = ClaimedNotificationDelivery & {
  notification_events?: NotificationEventRow | NotificationEventRow[] | null;
};

export type NotificationDeliverCronStats = {
  eventsProcessed: number;
  deliveriesCreated: number;
  deliveriesProcessed: number;
  sent: number;
  failed: number;
  skipped: number;
  eventFanOutErrors: number;
  staleEventLocksReleased: number;
  staleDeliveriesReleased: number;
  pendingEventsRemaining: number;
  pendingDeliveriesRemaining: number;
  runBudgetMs: number;
  timedOut: boolean;
};

type FanOutResult = {
  created: number;
  error: string | null;
};

function beforeDeadline(deadlineMs: number): boolean {
  return Date.now() < deadlineMs;
}

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
): Promise<FanOutResult> {
  if (!isNotificationModuleId(event.module)) {
    return { created: 0, error: null };
  }

  const moduleId = event.module as NotificationModuleId;
  let targets = await loadStaffTargetsForEvent(admin, event);
  if (
    moduleId === "staff_todo_completed" ||
    moduleId === "staff_todo_deferred"
  ) {
    targets = await filterStaffTodoPushTargets(admin, targets);
  }
  if (targets.length === 0) return { created: 0, error: null };

  const prefsMap = await loadPreferencesMap(admin, targets);
  const skipProfileId = actorProfileIdFromPayload(event.payload ?? {});
  const rows: {
    event_id: string;
    profile_id: string;
    context_restaurant_id: string;
    channel: "whatsapp" | "email";
    idempotency_key: string;
  }[] = [];

  for (const target of targets) {
    if (skipProfileId && target.profileId === skipProfileId) {
      continue;
    }

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

  if (rows.length === 0) return { created: 0, error: null };

  const { error } = await admin
    .from("notification_deliveries")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });

  if (error) {
    console.warn("[notification-deliver] fan-out", event.id, error.message);
    return { created: 0, error: error.message };
  }

  return { created: rows.length, error: null };
}

async function processUnprocessedEvents(
  admin: SupabaseClient,
  deadlineMs: number,
): Promise<{
  processed: number;
  deliveriesCreated: number;
  eventFanOutErrors: number;
}> {
  let processed = 0;
  let deliveriesCreated = 0;
  let eventFanOutErrors = 0;
  let iterations = 0;

  while (
    beforeDeadline(deadlineMs) &&
    iterations < NOTIFICATION_DELIVER_MAX_LOOP_ITERATIONS
  ) {
    iterations += 1;

    const events = await claimUnprocessedNotificationEvents(
      admin,
      NOTIFICATION_DELIVER_EVENTS_BATCH,
    );

    if (!events.length) break;

    for (const event of events as NotificationEventRow[]) {
      const result = await fanOutEvent(admin, event);

      if (result.error) {
        await releaseNotificationEventLock(admin, event.id);
        eventFanOutErrors += 1;
        continue;
      }

      const completed = await completeNotificationEventProcessing(
        admin,
        event.id,
      );
      if (!completed) {
        await releaseNotificationEventLock(admin, event.id);
        eventFanOutErrors += 1;
        continue;
      }

      deliveriesCreated += result.created;
      processed += 1;
    }

    if (events.length < NOTIFICATION_DELIVER_EVENTS_BATCH) break;
  }

  return { processed, deliveriesCreated, eventFanOutErrors };
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
        claimed_at: null,
      })
      .eq("id", delivery.id)
      .eq("status", "processing");
    return "sent";
  }

  if (outcome.kind === "skip") {
    await admin
      .from("notification_deliveries")
      .update({
        status: "failed",
        attempts,
        last_error: outcome.error,
        claimed_at: null,
      })
      .eq("id", delivery.id)
      .eq("status", "processing");
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
        claimed_at: null,
      })
      .eq("id", delivery.id)
      .eq("status", "processing");
    return "failed";
  }

  await admin
    .from("notification_deliveries")
    .update({
      status: "failed",
      attempts,
      last_error: outcome.error,
      claimed_at: null,
    })
    .eq("id", delivery.id)
    .eq("status", "processing");
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
  const { text, subject, emailDetails, href, platformCode } =
    buildNotificationPushText(
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
    emailDetails,
    href,
    platformCode,
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

async function loadEventsForDeliveries(
  admin: SupabaseClient,
  deliveries: ClaimedNotificationDelivery[],
): Promise<Map<string, NotificationEventRow>> {
  const eventIds = [...new Set(deliveries.map((d) => d.event_id))];
  if (eventIds.length === 0) return new Map();

  const { data, error } = await admin
    .from("notification_events")
    .select("id, restaurant_id, module, reference_id, payload")
    .in("id", eventIds);

  if (error) {
    console.warn("[notification-deliver] load events", error.message);
    return new Map();
  }

  const map = new Map<string, NotificationEventRow>();
  for (const row of data ?? []) {
    const event = row as NotificationEventRow;
    map.set(event.id, {
      ...event,
      payload:
        event.payload && typeof event.payload === "object"
          ? event.payload
          : {},
    });
  }
  return map;
}

async function processPendingDeliveries(
  admin: SupabaseClient,
  deadlineMs: number,
): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const restaurantNames = new Map<string, string | null>();
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let iterations = 0;

  while (
    beforeDeadline(deadlineMs) &&
    iterations < NOTIFICATION_DELIVER_MAX_LOOP_ITERATIONS
  ) {
    iterations += 1;

    const claimed = await claimNotificationDeliveries(
      admin,
      NOTIFICATION_DELIVER_SEND_BATCH,
    );

    if (!claimed.length) break;

    const eventsById = await loadEventsForDeliveries(admin, claimed);
    const due: DeliveryRow[] = claimed.map((delivery) => ({
      ...delivery,
      notification_events: eventsById.get(delivery.event_id) ?? null,
    }));

    for (let i = 0; i < due.length; i += 1) {
      if (!beforeDeadline(deadlineMs)) break;

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

    processed += claimed.length;

    if (claimed.length < NOTIFICATION_DELIVER_SEND_BATCH) break;
  }

  return { processed, sent, failed, skipped };
}

export type NotificationDeliverForEventResult = {
  ok: boolean;
  reason?: string;
  deliveriesCreated?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
};

/**
 * Fan-out + Versand für ein Event (Webhook/Ingest). Idempotent:
 * - Event-Claim per RPC (SKIP LOCKED) — kein Doppel-Fan-out mit Cron
 * - Deliveries: idempotency_key + processing-Claim — kein Doppelversand
 */
export async function runNotificationDeliverForEvent(
  admin: SupabaseClient,
  eventId: string,
): Promise<NotificationDeliverForEventResult> {
  const event = await claimNotificationEventById(admin, eventId);
  if (!event) {
    return { ok: true, reason: "not_claimed" };
  }

  const fanOut = await fanOutEvent(admin, event as NotificationEventRow);
  if (fanOut.error) {
    await releaseNotificationEventLock(admin, eventId);
    return { ok: false, reason: fanOut.error };
  }

  const completed = await completeNotificationEventProcessing(admin, eventId);
  if (!completed) {
    await releaseNotificationEventLock(admin, eventId);
    return { ok: false, reason: "complete_failed" };
  }

  const deadlineMs = Date.now() + NOTIFICATION_IMMEDIATE_DELIVER_BUDGET_MS;
  const eventRow = event as NotificationEventRow;
  const restaurantNames = new Map<string, string | null>();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let iterations = 0;

  while (
    beforeDeadline(deadlineMs) &&
    iterations < NOTIFICATION_DELIVER_MAX_LOOP_ITERATIONS
  ) {
    iterations += 1;

    const claimed = await claimNotificationDeliveriesForEvent(
      admin,
      eventId,
      NOTIFICATION_DELIVER_SEND_BATCH,
    );
    if (!claimed.length) break;

    for (const delivery of claimed) {
      if (!beforeDeadline(deadlineMs)) break;

      const restaurantId = delivery.context_restaurant_id;
      if (!restaurantNames.has(restaurantId)) {
        restaurantNames.set(
          restaurantId,
          await fetchRestaurantName(admin, restaurantId),
        );
      }

      const outcome = await deliverOne(
        admin,
        {
          ...delivery,
          notification_events: eventRow,
        },
        restaurantNames,
      );
      if (outcome === "sent") sent += 1;
      else if (outcome === "skipped") skipped += 1;
      else failed += 1;
    }

    if (claimed.length < NOTIFICATION_DELIVER_SEND_BATCH) break;
  }

  return {
    ok: true,
    deliveriesCreated: fanOut.created,
    sent,
    failed,
    skipped,
  };
}

async function countPendingQueue(
  admin: SupabaseClient,
): Promise<{ pendingEventsRemaining: number; pendingDeliveriesRemaining: number }> {
  const now = new Date().toISOString();

  const [{ count: pendingEvents }, { count: pendingDeliveries }] =
    await Promise.all([
      admin
        .from("notification_events")
        .select("id", { count: "exact", head: true })
        .is("processed_at", null),
      admin
        .from("notification_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lte("scheduled_at", now),
    ]);

  return {
    pendingEventsRemaining: pendingEvents ?? 0,
    pendingDeliveriesRemaining: pendingDeliveries ?? 0,
  };
}

export async function runNotificationDeliverCron(
  admin: SupabaseClient,
): Promise<NotificationDeliverCronStats> {
  const deadlineMs = Date.now() + NOTIFICATION_DELIVER_RUN_BUDGET_MS;

  const staleDeliveriesReleased =
    await releaseStaleNotificationDeliveries(admin);
  const staleEventLocksReleased =
    await releaseStaleNotificationEventLocks(admin);

  const eventStats = await processUnprocessedEvents(admin, deadlineMs);
  const sendStats = await processPendingDeliveries(admin, deadlineMs);
  const queues = await countPendingQueue(admin);

  return {
    eventsProcessed: eventStats.processed,
    deliveriesCreated: eventStats.deliveriesCreated,
    deliveriesProcessed: sendStats.processed,
    sent: sendStats.sent,
    failed: sendStats.failed,
    skipped: sendStats.skipped,
    eventFanOutErrors: eventStats.eventFanOutErrors,
    staleEventLocksReleased,
    staleDeliveriesReleased,
    pendingEventsRemaining: queues.pendingEventsRemaining,
    pendingDeliveriesRemaining: queues.pendingDeliveriesRemaining,
    runBudgetMs: NOTIFICATION_DELIVER_RUN_BUDGET_MS,
    timedOut: Date.now() >= deadlineMs,
  };
}
