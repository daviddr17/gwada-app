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
