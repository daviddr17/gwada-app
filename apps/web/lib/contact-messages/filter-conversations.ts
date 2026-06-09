import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export type ConversationReadFilter = "all" | "unread" | "read";

export function parseConversationReadFilter(
  value: string | null | undefined,
): ConversationReadFilter {
  if (value === "unread" || value === "read") return value;
  return "all";
}

export function applyConversationReadFilterToSearchParams(
  params: URLSearchParams,
  filter: ConversationReadFilter,
): void {
  if (filter === "all") {
    params.delete("read");
  } else {
    params.set("read", filter);
  }
}

/** Clientseitige Chat-Suche (Name, letzte Nachricht, Telefon/E-Mail aus Pseudo-ID). */
export function filterContactConversations(
  conversations: ContactConversationPreview[],
  query: string,
): ContactConversationPreview[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;

  return conversations.filter((c) => {
    const idHint = c.contact_id
      .replace(/^waha:/, "")
      .replace(/^email:/, "")
      .replace(/@.*/, "")
      .replace(/\D/g, " ");

    const hay = [c.contact_name, c.last_body, idHint].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

export function filterConversationsByRead(
  conversations: ContactConversationPreview[],
  readFilter: ConversationReadFilter,
): ContactConversationPreview[] {
  if (readFilter === "all") return conversations;
  if (readFilter === "unread") {
    return conversations.filter((c) => c.is_unread);
  }
  return conversations.filter((c) => !c.is_unread);
}
