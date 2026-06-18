import "server-only";

import { after } from "next/server";
import { runNotificationDeliverForEvent } from "@/lib/notifications/notification-deliver-cron";
import type { SupabaseClient } from "@supabase/supabase-js";

function runImmediateDeliver(admin: SupabaseClient, eventId: string): void {
  void runNotificationDeliverForEvent(admin, eventId).catch((err) => {
    console.warn(
      "[notification-deliver] immediate",
      eventId,
      err instanceof Error ? err.message : err,
    );
  });
}

/** Push-Zustellung für frisch angelegte DB-Events (z. B. neue Google-Bewertung). */
export async function scheduleDeliverForNotificationReferences(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    module: string;
    referenceIds: string[];
  },
): Promise<void> {
  if (params.referenceIds.length === 0) return;

  const { data, error } = await admin
    .from("notification_events")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module)
    .in("reference_id", params.referenceIds)
    .is("processed_at", null);

  if (error) {
    console.warn(
      "[notification-deliver] schedule by reference",
      error.message,
    );
    return;
  }

  for (const row of data ?? []) {
    scheduleNotificationDeliverForEvent(admin, (row as { id: string }).id);
  }
}

/** Fan-out + Versand nach Webhook/Ingest — Cron bleibt Fallback. */
export function scheduleNotificationDeliverForEvent(
  admin: SupabaseClient,
  eventId: string,
): void {
  try {
    after(() => runImmediateDeliver(admin, eventId));
  } catch {
    runImmediateDeliver(admin, eventId);
  }
}
