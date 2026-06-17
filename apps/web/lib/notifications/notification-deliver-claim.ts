import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimedNotificationDelivery = {
  id: string;
  event_id: string;
  profile_id: string;
  context_restaurant_id: string;
  channel: "whatsapp" | "email";
  attempts: number;
};

export type ClaimedNotificationEvent = {
  id: string;
  restaurant_id: string | null;
  module: string;
  reference_id: string;
  payload: Record<string, unknown>;
};

export async function claimNotificationEventById(
  admin: SupabaseClient,
  eventId: string,
): Promise<ClaimedNotificationEvent | null> {
  const { data, error } = await admin.rpc("claim_notification_event_by_id", {
    p_event_id: eventId,
  });
  if (error) {
    console.warn("[notification-deliver] claim event by id", eventId, error.message);
    return null;
  }
  const row = (data ?? [])[0] as ClaimedNotificationEvent & { payload?: unknown } | undefined;
  if (!row) return null;
  return {
    ...row,
    payload:
      row.payload && typeof row.payload === "object"
        ? (row.payload as Record<string, unknown>)
        : {},
  };
}

export async function claimNotificationDeliveriesForEvent(
  admin: SupabaseClient,
  eventId: string,
  limit: number,
): Promise<ClaimedNotificationDelivery[]> {
  const { data, error } = await admin.rpc(
    "claim_notification_deliveries_for_event",
    { p_event_id: eventId, p_limit: limit },
  );
  if (error) {
    console.warn(
      "[notification-deliver] claim deliveries for event",
      eventId,
      error.message,
    );
    return [];
  }
  return (data ?? []) as ClaimedNotificationDelivery[];
}

export async function releaseStaleNotificationDeliveries(
  admin: SupabaseClient,
  staleMinutes = 15,
): Promise<number> {
  const { data, error } = await admin.rpc(
    "release_stale_notification_deliveries",
    { p_stale_minutes: staleMinutes },
  );
  if (error) {
    console.warn("[notification-deliver] release stale", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export async function claimNotificationDeliveries(
  admin: SupabaseClient,
  limit: number,
): Promise<ClaimedNotificationDelivery[]> {
  const { data, error } = await admin.rpc("claim_notification_deliveries", {
    p_limit: limit,
  });
  if (error) {
    console.warn("[notification-deliver] claim deliveries", error.message);
    return [];
  }
  return (data ?? []) as ClaimedNotificationDelivery[];
}

export async function claimUnprocessedNotificationEvents(
  admin: SupabaseClient,
  limit: number,
): Promise<ClaimedNotificationEvent[]> {
  const { data, error } = await admin.rpc(
    "claim_unprocessed_notification_events",
    { p_limit: limit },
  );
  if (error) {
    console.warn("[notification-deliver] lock events", error.message);
    return [];
  }
  return (data ?? []).map((row: ClaimedNotificationEvent & { payload?: unknown }) => {
    const event = row;
    return {
      ...event,
      payload:
        event.payload && typeof event.payload === "object"
          ? (event.payload as Record<string, unknown>)
          : {},
    };
  });
}

export async function completeNotificationEventProcessing(
  admin: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc(
    "complete_notification_event_processing",
    { p_event_id: eventId },
  );
  if (error) {
    console.warn("[notification-deliver] complete event", eventId, error.message);
    return false;
  }
  return data === true;
}

export async function releaseNotificationEventLock(
  admin: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("release_notification_event_lock", {
    p_event_id: eventId,
  });
  if (error) {
    console.warn("[notification-deliver] release event lock", eventId, error.message);
    return false;
  }
  return data === true;
}

export async function releaseStaleNotificationEventLocks(
  admin: SupabaseClient,
  staleMinutes = 5,
): Promise<number> {
  const { data, error } = await admin.rpc(
    "release_stale_notification_event_locks",
    { p_stale_minutes: staleMinutes },
  );
  if (error) {
    console.warn("[notification-deliver] release stale event locks", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
