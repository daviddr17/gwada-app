import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { countsTowardGwadaUnread } from "@/lib/contact-messages/conversation-read-state";
import {
  conversationThreadKeyFromRow,
  defaultConversationLabel,
} from "@/lib/contact-messages/conversation-thread-key";
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

function emailImapInboundIsUnread(
  direction: string,
  externalSourceId: string | null | undefined,
  externalSeen: boolean | null | undefined,
): boolean {
  if (direction !== "inbound") return false;
  const ext = externalSourceId?.trim() ?? "";
  if (!ext.startsWith("email-imap:")) return false;
  if (externalSeen === false) return true;
  return false;
}

/** Gemeinsame Logik: contact_messages-Zeilen → Konversations-Vorschau pro Plattform. */
export function buildContactConversationsFromRows(params: {
  platform: ContactMessagePlatform;
  rows: Record<string, unknown>[];
  attachmentsByMessage: Map<string, RawMessageAttachmentRow[]>;
}): ContactConversationPreview[] {
  const countByThread = new Map<string, number>();
  const hasReservationByThread = new Map<string, boolean>();
  const inboundAfter = new Map<string, number>();
  const emailUnreadByThread = new Map<string, number>();
  const previews = new Map<string, ContactConversationPreview>();
  const lastInboundByThread = new Map<string, ContactMessagePlatform>();

  for (const raw of params.rows) {
    const threadKey = conversationThreadKeyFromRow({
      contact_id: raw.contact_id as string | null,
      conversation_key: raw.conversation_key as string | null,
    });
    if (!threadKey) continue;

    countByThread.set(threadKey, (countByThread.get(threadKey) ?? 0) + 1);
    if (raw.reservation_id) {
      hasReservationByThread.set(threadKey, true);
    }

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
      emailImapInboundIsUnread(
        mapped.direction,
        ext || null,
        raw.external_seen as boolean | null | undefined,
      )
    ) {
      emailUnreadByThread.set(
        threadKey,
        (emailUnreadByThread.get(threadKey) ?? 0) + 1,
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
    const contactName = contact
      ? contactDisplayName(contact)
      : (raw.conversation_label as string | null)?.trim() ||
        (conversationKey ? defaultConversationLabel(conversationKey) : "Chat");

    const mirrored =
      ext.startsWith("waha:") || msgPlatform === "whatsapp"
        ? previewBodyAndKindFromWhatsappMirror(mapped.body.trim())
        : {
            body: mapped.body.trim(),
            attachmentKind: undefined as ContactMessageAttachmentKind | undefined,
          };

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
      has_reservation_link: false,
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
    preview.has_reservation_link =
      hasReservationByThread.get(threadKey) ?? false;
    preview.last_inbound_platform = lastInboundByThread.get(threadKey);
    if (params.platform === "email") {
      const emailUnread = emailUnreadByThread.get(threadKey) ?? 0;
      preview.email_unread_count = emailUnread;
      preview.unread_count = emailUnread;
      preview.is_unread = emailUnread > 0;
    }
  }

  return [...previews.values()].sort((a, b) =>
    b.last_at.localeCompare(a.last_at),
  );
}
