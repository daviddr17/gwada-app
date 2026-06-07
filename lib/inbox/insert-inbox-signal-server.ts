import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type InboxSignalSource = "waha" | "email";

/** Realtime-Hinweis für Client: Inbox im Hintergrund aktualisieren (Service-Role). */
export async function insertInboxSignalServer(
  admin: SupabaseClient,
  params: { restaurantId: string; source: InboxSignalSource },
): Promise<void> {
  const { error } = await admin.from("restaurant_inbox_signals").insert({
    restaurant_id: params.restaurantId,
    source: params.source,
  });
  if (error) {
    console.warn("[inbox-signal] insert", error.message);
  }
}
