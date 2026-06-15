import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** notification_events für Nachrichten (Trigger oder emit — gleiche reference_id). */
export async function findMessageNotificationEventId(
  admin: SupabaseClient,
  restaurantId: string,
  referenceId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("notification_events")
    .select("id")
    .eq("module", "messages")
    .eq("reference_id", referenceId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const id = (data as { id?: string } | null)?.id;
  return typeof id === "string" ? id : null;
}
