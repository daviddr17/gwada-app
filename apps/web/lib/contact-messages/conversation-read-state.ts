import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";

export type ConversationReadRow = {
  conversation_key: string;
  platform: ContactMessagePlatform;
  last_read_at: string | null;
  marked_unread_at: string | null;
};

export type ConversationUnreadInput = {
  last_at: string;
  last_direction: "inbound" | "outbound";
  inbound_count?: number;
  external_unread_count?: number | null;
};

/** IMAP-/WAHA-Spiegel in `contact_messages` — Unread kommt von externer Quelle. */
export function isExternalInboxMirrorSource(
  externalSourceId: string | null | undefined,
): boolean {
  const ext = externalSourceId?.trim() ?? "";
  return ext.startsWith("email-imap:") || ext.startsWith("waha:");
}

export function countsTowardGwadaUnread(params: {
  direction: "inbound" | "outbound";
  externalSourceId?: string | null;
}): boolean {
  if (params.direction !== "inbound") return false;
  return !isExternalInboxMirrorSource(params.externalSourceId);
}

export function isConversationMarkedUnread(row: ConversationReadRow | undefined): boolean {
  if (!row?.marked_unread_at) return false;
  if (!row.last_read_at) return true;
  return (
    new Date(row.marked_unread_at).getTime() >
    new Date(row.last_read_at).getTime()
  );
}

export function computeConversationUnread(params: {
  read?: ConversationReadRow;
  conversation: ConversationUnreadInput;
}): { unread_count: number; is_unread: boolean } {
  /** IMAP / WAHA: externe Quelle ist maßgeblich (auch wenn 0 = gelesen). */
  if (params.conversation.external_unread_count != null) {
    const external = Math.max(0, params.conversation.external_unread_count);
    if (isConversationMarkedUnread(params.read) && external === 0) {
      return { unread_count: 1, is_unread: true };
    }
    return { unread_count: external, is_unread: external > 0 };
  }

  if (isConversationMarkedUnread(params.read)) {
    const base =
      params.conversation.inbound_count && params.conversation.inbound_count > 0
        ? params.conversation.inbound_count
        : params.conversation.last_direction === "inbound"
          ? 1
          : 1;
    return { unread_count: base, is_unread: true };
  }

  const lastRead = params.read?.last_read_at;
  if (!lastRead) {
    if (params.conversation.last_direction === "inbound") {
      return {
        unread_count: params.conversation.inbound_count ?? 1,
        is_unread: true,
      };
    }
    return { unread_count: 0, is_unread: false };
  }

  const lastAt = new Date(params.conversation.last_at).getTime();
  const readAt = new Date(lastRead).getTime();
  if (lastAt > readAt && params.conversation.last_direction === "inbound") {
    const n = params.conversation.inbound_count ?? 1;
    return { unread_count: n, is_unread: true };
  }

  return { unread_count: 0, is_unread: false };
}

export function conversationReadLookupKey(
  conversationKey: string,
  platform: ContactMessagePlatform,
): string {
  return `${platform}:${conversationKey}`;
}
