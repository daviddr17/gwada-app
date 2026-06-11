import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";

/** WAHA-Reactions / Edit / Delete: ID aus Zeile ableiten. */
export function enrichMessagesWithWahaReactionIds(
  messages: ContactMessageRow[],
): ContactMessageRow[] {
  return messages.map((m) => {
    if (m.waha_message_id) return m;

    const ext = m.external_source_id?.trim();
    if (ext?.startsWith("waha:")) {
      return { ...m, waha_message_id: ext.slice(5) };
    }

    if (m.id.startsWith("waha:")) {
      const wahaMessageId = m.id.slice(5);
      return {
        ...m,
        waha_message_id: wahaMessageId,
        external_source_id: ext ?? m.id,
      };
    }

    return m;
  });
}

export function threadHasWahaReactionTargets(
  messages: ContactMessageRow[],
): boolean {
  return enrichMessagesWithWahaReactionIds(messages).some(
    (m) => Boolean(m.waha_message_id),
  );
}
