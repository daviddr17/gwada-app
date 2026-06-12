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
    console.warn("[notification-deliver] claim events", error.message);
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
