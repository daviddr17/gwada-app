import type { InboxPlatformFilter } from "@/lib/constants/contact-message-platforms";
import { INBOX_FILTER_ALL } from "@/lib/constants/contact-message-platforms";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { isEmailPseudoContactId } from "@/lib/contact-messages/email-pseudo-contact";
import {
  isMetaPseudoContactId,
  metaPlatformFromPseudoContactId,
} from "@/lib/contact-messages/meta-pseudo-contact";
import { isWahaPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { pickConversationUnreadHint } from "@/lib/contact-messages/conversation-read-state";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

function pickNewer(
  a: ContactConversationPreview,
  b: ContactConversationPreview,
): ContactConversationPreview {
  if (a.last_at >= b.last_at) {
    return mergePreviewFields(a, b);
  }
  return mergePreviewFields(b, a);
}

function mergePreviewFields(
  newer: ContactConversationPreview,
  older: ContactConversationPreview,
): ContactConversationPreview {
  return {
    ...newer,
    contact_name: newer.contact_name?.trim() || older.contact_name,
    message_count: Math.max(newer.message_count, older.message_count),
    unread_count: Math.max(newer.unread_count, older.unread_count),
    is_unread: newer.is_unread || older.is_unread,
    has_reservation_link: newer.has_reservation_link,
    last_reservation_id: newer.last_reservation_id ?? null,
    last_message_platform:
      newer.last_message_platform ?? older.last_message_platform,
    last_inbound_platform:
      newer.last_inbound_platform ?? older.last_inbound_platform,
    inbound_since_preview: Math.max(
      newer.inbound_since_preview ?? 0,
      older.inbound_since_preview ?? 0,
    ),
    last_attachment_kind:
      newer.last_attachment_kind ?? older.last_attachment_kind,
    last_is_reaction: newer.last_is_reaction ?? older.last_is_reaction,
    email_unread_count: Math.max(
      newer.email_unread_count ?? 0,
      older.email_unread_count ?? 0,
    ),
    whatsapp_unread_count: Math.max(
      newer.whatsapp_unread_count ?? 0,
      older.whatsapp_unread_count ?? 0,
    ),
    unread_hint: pickConversationUnreadHint([
      newer.unread_hint,
      older.unread_hint,
    ]),
  };
}

/** Mehrere Postfach-Quellen zu einer Liste pro `contact_id` zusammenführen. */
export function mergeInboxConversationPreviews(
  sources: ContactConversationPreview[][],
): ContactConversationPreview[] {
  const byId = new Map<string, ContactConversationPreview>();

  for (const list of sources) {
    for (const c of list) {
      const existing = byId.get(c.contact_id);
      byId.set(c.contact_id, existing ? pickNewer(existing, c) : c);
    }
  }

  return [...byId.values()].sort((a, b) =>
    b.last_at.localeCompare(a.last_at),
  );
}

export function filterInboxConversationsByPlatform(
  conversations: ContactConversationPreview[],
  filter: InboxPlatformFilter,
): ContactConversationPreview[] {
  if (filter === INBOX_FILTER_ALL) return conversations;

  return conversations.filter((c) => {
    if (filter === "whatsapp" && isWahaPseudoContactId(c.contact_id)) {
      return true;
    }
    if (filter === "email" && isEmailPseudoContactId(c.contact_id)) {
      return true;
    }
    if (filter === "facebook" && metaPlatformFromPseudoContactId(c.contact_id) === "facebook") {
      return true;
    }
    if (filter === "instagram" && metaPlatformFromPseudoContactId(c.contact_id) === "instagram") {
      return true;
    }
    if (
      isWahaPseudoContactId(c.contact_id) ||
      isEmailPseudoContactId(c.contact_id) ||
      isMetaPseudoContactId(c.contact_id)
    ) {
      return false;
    }
    const last = c.last_message_platform ?? c.platform;
    return last === filter;
  });
}

export function conversationChannelForRead(
  contactId: string,
): ContactMessagePlatform {
  if (isWahaPseudoContactId(contactId)) return "whatsapp";
  if (isEmailPseudoContactId(contactId)) return "email";
  const meta = metaPlatformFromPseudoContactId(contactId);
  if (meta) return meta;
  return "gwada";
}
