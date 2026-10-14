import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

/** Graph-ID, auch wenn die DB sie als `meta:facebook:…` gespeichert hat. */
export function metaThreadMessageKey(message: ContactMessageRow): string {
  const metaId = message.meta_message_id?.trim();
  if (metaId) return metaId;
  const ext = message.external_source_id?.trim() ?? "";
  const prefixed = /^meta:(?:facebook|instagram):(.+)$/.exec(ext);
  if (prefixed?.[1]) return prefixed[1];
  return ext || message.id;
}

/** Live-Graph-Verlauf gewinnt bei gleicher Nachricht, DB-only-Zeilen bleiben. */
export function mergeMetaThreadMessages(
  graph: ContactMessageRow[],
  stored: ContactMessageRow[],
): ContactMessageRow[] {
  const byKey = new Map<string, ContactMessageRow>();
  for (const row of stored) {
    byKey.set(metaThreadMessageKey(row), row);
  }
  for (const row of graph) {
    byKey.set(metaThreadMessageKey(row), row);
  }
  return [...byKey.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}
