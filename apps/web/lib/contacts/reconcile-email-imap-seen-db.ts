import "server-only";

import type { ImapCredentials } from "@/lib/email/imap-inbox";
import { fetchImapRecentEnvelopes } from "@/lib/email/imap-inbox";
import type { SupabaseClient } from "@supabase/supabase-js";

const EXTERNAL_PREFIX = "email-imap:";

function externalIdForUid(uid: number): string {
  return `${EXTERNAL_PREFIX}${uid}`;
}

/** IMAP-\\Seen → contact_messages.external_seen (Background-Sync, kein Listen-IMAP). */
export async function reconcileEmailImapSeenInDb(
  admin: SupabaseClient,
  restaurantId: string,
  creds: ImapCredentials,
): Promise<void> {
  const { data: envelopes, error } = await fetchImapRecentEnvelopes(creds);
  if (error || envelopes.length === 0) return;

  const seenByExt = new Map<string, boolean>();
  for (const env of envelopes) {
    seenByExt.set(externalIdForUid(env.uid), env.seen);
  }

  const extIds = [...seenByExt.keys()];
  const { data: rows } = await admin
    .from("contact_messages")
    .select("id, external_source_id, external_seen")
    .eq("restaurant_id", restaurantId)
    .in("external_source_id", extIds);

  for (const raw of rows ?? []) {
    const row = raw as {
      id: string;
      external_source_id: string;
      external_seen: boolean | null;
    };
    const imapSeen = seenByExt.get(row.external_source_id);
    if (imapSeen === undefined || row.external_seen === imapSeen) continue;
    await admin
      .from("contact_messages")
      .update({ external_seen: imapSeen })
      .eq("id", row.id);
  }
}
