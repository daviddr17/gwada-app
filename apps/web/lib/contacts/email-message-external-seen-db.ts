import "server-only";

import { setMirrorThreadExternalSeenInDb } from "@/lib/contacts/message-thread-external-seen-db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** IMAP-\\Seen für alle eingehenden E-Mail-Spiegel eines Threads setzen. */
export async function setEmailThreadExternalSeenInDb(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    conversationKey: string;
    seen: boolean;
  },
): Promise<void> {
  await setMirrorThreadExternalSeenInDb(admin, {
    ...params,
    platform: "email",
  });
}
