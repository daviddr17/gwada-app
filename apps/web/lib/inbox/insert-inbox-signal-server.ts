import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type InboxSignalSource =
  | "waha"
  | "waha_ack"
  | "waha_reaction"
  | "email";

/** Realtime-Hinweis für Client: Inbox im Hintergrund aktualisieren (Service-Role). */
export async function insertInboxSignalServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    source: InboxSignalSource;
    payload?: Record<string, unknown> | null;
  },
): Promise<void> {
  const { error } = await admin.from("restaurant_inbox_signals").insert({
    restaurant_id: params.restaurantId,
    source: params.source,
    ...(params.payload != null ? { payload: params.payload } : {}),
  });
  if (error) {
    console.warn("[inbox-signal] insert", error.message);
  }
}
