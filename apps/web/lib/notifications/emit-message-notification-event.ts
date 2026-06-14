import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Push-Event für Nachrichten (wenn kein contact_messages-Trigger greift, z. B. unverknüpfter WAHA-Chat). */
export async function emitMessageNotificationEventIfNew(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    referenceId: string;
    payload: Record<string, unknown>;
  },
): Promise<boolean> {
  const { data: existing } = await admin
    .from("notification_events")
    .select("id")
    .eq("module", "messages")
    .eq("reference_id", params.referenceId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (existing) return false;

  const { error } = await admin.from("notification_events").insert({
    restaurant_id: params.restaurantId,
    module: "messages",
    reference_id: params.referenceId,
    payload: params.payload,
  });

  if (error) {
    console.warn("[notification] emit messages event", error.message);
    return false;
  }

  return true;
}
