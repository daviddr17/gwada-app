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

export type ConversationUnreadHint = "channel" | "gwada_only";

export type ConversationUnreadResult = {
  unread_count: number;
  is_unread: boolean;
  unread_hint: ConversationUnreadHint | null;
};

export function pickConversationUnreadHint(
  hints: Array<ConversationUnreadHint | null | undefined>,
): ConversationUnreadHint | null {
  if (hints.some((h) => h === "channel")) return "channel";
  if (hints.some((h) => h === "gwada_only")) return "gwada_only";
  return null;
}

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
}): ConversationUnreadResult {
  /** IMAP / WAHA: externer Kanal + persönlicher Gwada-Stand pro Mitarbeiter. */
  if (params.conversation.external_unread_count != null) {
    const external = Math.max(0, params.conversation.external_unread_count);
    if (external > 0) {
      return {
        unread_count: external,
        is_unread: true,
        unread_hint: "channel",
      };
    }

    const personal = computePersonalGwadaUnread(params);
    if (personal.is_unread) {
      return {
        unread_count: personal.unread_count,
        is_unread: true,
        unread_hint: "gwada_only",
      };
    }

    return { unread_count: 0, is_unread: false, unread_hint: null };
  }

  const personal = computePersonalGwadaUnread(params);
  return {
    ...personal,
    unread_hint: personal.is_unread ? "channel" : null,
  };
}

function computePersonalGwadaUnread(params: {
  read?: ConversationReadRow;
  conversation: ConversationUnreadInput;
}): { unread_count: number; is_unread: boolean } {
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
      const count = params.conversation.inbound_count ?? 1;
      return { unread_count: count, is_unread: count > 0 };
    }
    return { unread_count: 0, is_unread: false };
  }

  const lastAt = new Date(params.conversation.last_at).getTime();
  const readAt = new Date(lastRead).getTime();
  if (lastAt > readAt && params.conversation.last_direction === "inbound") {
    const count = params.conversation.inbound_count ?? 1;
    return { unread_count: count, is_unread: count > 0 };
  }

  return { unread_count: 0, is_unread: false };
}

export function conversationReadLookupKey(
  conversationKey: string,
  platform: ContactMessagePlatform,
): string {
  return `${platform}:${conversationKey}`;
}

/** Externer Kanal-Zähler (WAHA/IMAP) — nur wenn explizit gesetzt, nicht DB-Platzhalter 0. */
export function conversationExternalUnreadCount(
  conversation: {
    whatsapp_unread_count?: number;
    email_unread_count?: number;
  },
  platform: ContactMessagePlatform,
): number | null {
  if (platform === "whatsapp") {
    return conversation.whatsapp_unread_count !== undefined
      ? conversation.whatsapp_unread_count
      : null;
  }
  if (platform === "email") {
    return conversation.email_unread_count !== undefined
      ? conversation.email_unread_count
      : null;
  }
  return null;
}

export function conversationUnreadInput(
  conversation: {
    last_at: string;
    last_direction: "inbound" | "outbound";
    inbound_since_preview?: number;
    whatsapp_unread_count?: number;
    email_unread_count?: number;
  },
  platform: ContactMessagePlatform,
): ConversationUnreadInput {
  if (platform === "gwada") {
    return {
      last_at: conversation.last_at,
      last_direction: conversation.last_direction,
      inbound_count: conversation.inbound_since_preview,
    };
  }
  return {
    last_at: conversation.last_at,
    last_direction: conversation.last_direction,
    inbound_count: conversation.inbound_since_preview,
    external_unread_count: conversationExternalUnreadCount(
      conversation,
      platform,
    ),
  };
}
