import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

export type ConversationReadFilter = "all" | "unread" | "read" | "later";

export function parseConversationReadFilter(
  value: string | null | undefined,
): ConversationReadFilter {
  if (value === "unread" || value === "read" || value === "later") return value;
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

    const hay = [
      c.contact_name,
      c.last_body,
      idHint,
      c.follow_up_reason ?? "",
      c.follow_up_staff_name ?? "",
    ]
      .join(" ")
      .toLowerCase();
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
  if (readFilter === "later") {
    return conversations.filter((c) => Boolean(c.follow_up_id));
  }
  return conversations.filter((c) => !c.is_unread);
}

export function conversationHasFollowUp(
  conversation: Pick<ContactConversationPreview, "follow_up_id">,
): boolean {
  return Boolean(conversation.follow_up_id);
}
