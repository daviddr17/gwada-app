import "server-only";

import { syncContactEmailInbox } from "@/lib/contacts/sync-restaurant-email-inbox";
import type { SupabaseClient } from "@supabase/supabase-js";

/** @deprecated Name — spiegelt E-Mail-Antworten als `platform: email` in den Kontakt-Verlauf. */
export async function syncEmailRepliesIntoGwadaChat(
  admin: SupabaseClient,
  params: { restaurantId: string; contactId: string },
): Promise<{ imported: number; error: string | null }> {
  return syncContactEmailInbox(admin, params);
}
