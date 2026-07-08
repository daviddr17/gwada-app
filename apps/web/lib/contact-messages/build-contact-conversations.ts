import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import {
  countsTowardGwadaUnread,
  mirrorInboundIsChannelUnread,
} from "@/lib/contact-messages/conversation-read-state";

import {
  conversationThreadKeyFromRow,
} from "@/lib/contact-messages/conversation-thread-key";
import { displayNameForPseudoConversation } from "@/lib/contact-messages/waha-chat-label";
import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import { primaryAttachmentKind } from "@/lib/contact-messages/last-attachment-kind";
import { previewBodyAndKindFromWhatsappMirror } from "@/lib/contact-messages/whatsapp-mirror-preview";
import { contactDisplayName } from "@/lib/supabase/contacts-db";
import {
  mapContactMessageRowFromRecord,
  type ContactConversationPreview,
} from "@/lib/supabase/contact-messages-db";
import type { RawMessageAttachmentRow } from "@/lib/contact-messages/fetch-message-attachments";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

/** Gemeinsame Logik: contact_messages-Zeilen → Konversations-Vorschau pro Plattform. */
export function buildContactConversationsFromRows(params: {
  platform: ContactMessagePlatform;
  rows: Record<string, unknown>[];
  attachmentsByMessage: Map<string, RawMessageAttachmentRow[]>;
}): ContactConversationPreview[] {
  const countByThread = new Map<string, number>();
  const inboundAfter = new Map<string, number>();
  const emailUnreadByThread = new Map<string, number>();
  const whatsappUnreadByThread = new Map<string, number>();
  const previews = new Map<string, ContactConversationPreview>();
  const lastInboundByThread = new Map<string, ContactMessagePlatform>();

  for (const raw of params.rows) {
    const threadKey = conversationThreadKeyFromRow({
      contact_id: raw.contact_id as string | null,
      conversation_key: raw.conversation_key as string | null,
    });
    if (!threadKey) continue;

    countByThread.set(threadKey, (countByThread.get(threadKey) ?? 0) + 1);

    const mapped = mapContactMessageRowFromRecord(
      raw,
      params.attachmentsByMessage.get(raw.id as string) ?? [],
    );
    const msgPlatform = messageDisplayPlatform(mapped);
    const ext = (mapped.external_source_id as string | null) ?? "";

    if (
      countsTowardGwadaUnread({
        direction: mapped.direction,
        externalSourceId: ext || null,
      })
    ) {
      inboundAfter.set(threadKey, (inboundAfter.get(threadKey) ?? 0) + 1);
    }
    if (
      params.platform === "email" &&
      mirrorInboundIsChannelUnread({
        direction: mapped.direction,
        externalSourceId: ext || null,
        externalSeen: raw.external_seen as boolean | null | undefined,
      })
    ) {
      emailUnreadByThread.set(
        threadKey,
        (emailUnreadByThread.get(threadKey) ?? 0) + 1,
      );
    }
    if (
      params.platform === "whatsapp" &&
      mirrorInboundIsChannelUnread({
        direction: mapped.direction,
        externalSourceId: ext || null,
        externalSeen: raw.external_seen as boolean | null | undefined,
      })
    ) {
      whatsappUnreadByThread.set(
        threadKey,
        (whatsappUnreadByThread.get(threadKey) ?? 0) + 1,
      );
    }
    if (
      mapped.direction === "inbound" &&
      !lastInboundByThread.has(threadKey)
    ) {
      lastInboundByThread.set(threadKey, msgPlatform);
    }

    if (previews.has(threadKey)) continue;

    const contactRaw = raw.contacts;
    const contact = Array.isArray(contactRaw)
      ? (contactRaw[0] as { first_name: string; last_name: string })
      : (contactRaw as { first_name: string; last_name: string } | null);

    const conversationKey = raw.conversation_key as string | null;
    const storedLabel = (raw.conversation_label as string | null)?.trim() || null;
    const contactName = contact
      ? contactDisplayName(contact)
      : conversationKey
        ? displayNameForPseudoConversation({
            conversationKey,
            storedLabel,
          })
        : storedLabel || "Chat";

    const mirrored =
      ext.startsWith("waha:") || msgPlatform === "whatsapp"
        ? previewBodyAndKindFromWhatsappMirror(mapped.body.trim())
        : {
            body: mapped.body.trim(),
            attachmentKind: undefined as ContactMessageAttachmentKind | undefined,
          };

    const lastReservationId = (raw.reservation_id as string | null) ?? null;
    const suppressNotifications =
      (raw.suppress_notifications as boolean | null) === true;

    previews.set(threadKey, {
      contact_id: threadKey,
      contact_name: contactName,
      platform: params.platform,
      last_body: mirrored.body,
      last_at: mapped.created_at,
      last_direction: mapped.direction,
      message_count: 0,
      unread_count: 0,
      is_unread: false,
      has_reservation_link: Boolean(lastReservationId),
      last_reservation_id: lastReservationId,
      last_message_suppress_notifications: suppressNotifications,
      inbound_since_preview: inboundAfter.get(threadKey) ?? 0,
      last_attachment_kind:
        primaryAttachmentKind(mapped.attachments?.map((a) => a.kind)) ??
        mirrored.attachmentKind,
      last_message_platform: msgPlatform,
    });
  }

  for (const [threadKey, preview] of previews) {
    preview.message_count = countByThread.get(threadKey) ?? 0;
    preview.inbound_since_preview = inboundAfter.get(threadKey) ?? 0;
    preview.last_inbound_platform = lastInboundByThread.get(threadKey);
    if (params.platform === "email") {
      const emailUnread = emailUnreadByThread.get(threadKey) ?? 0;
      preview.email_unread_count = emailUnread;
      preview.unread_count = emailUnread;
      preview.is_unread = emailUnread > 0;
    }
    if (params.platform === "whatsapp") {
      const waUnread = whatsappUnreadByThread.get(threadKey) ?? 0;
      preview.whatsapp_unread_count = waUnread;
      preview.unread_count = waUnread;
      preview.is_unread = waUnread > 0;
    }
  }

  return [...previews.values()].sort((a, b) =>
    b.last_at.localeCompare(a.last_at),
  );
}
