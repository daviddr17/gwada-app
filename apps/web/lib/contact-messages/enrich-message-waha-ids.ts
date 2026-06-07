import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

/** WAHA-Reactions: ID aus `external_source_id` (`waha:…`) ableiten. */
export function enrichMessagesWithWahaReactionIds(
  messages: ContactMessageRow[],
): ContactMessageRow[] {
  return messages.map((m) => {
    if (m.waha_message_id) return m;
    const ext = m.external_source_id?.trim();
    if (!ext?.startsWith("waha:")) return m;
    return { ...m, waha_message_id: ext.slice(5) };
  });
}

export function threadHasWahaReactionTargets(
  messages: ContactMessageRow[],
): boolean {
  return enrichMessagesWithWahaReactionIds(messages).some(
    (m) => Boolean(m.waha_message_id),
  );
}
