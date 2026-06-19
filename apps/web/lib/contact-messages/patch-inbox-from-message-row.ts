import { inboxPreviewSnippet } from "@/lib/contact-messages/inbox-preview-snippet";
import { conversationNotificationPlatform } from "@/lib/contact-messages/conversation-notification-platform";
import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import { primaryAttachmentKind } from "@/lib/contact-messages/last-attachment-kind";
import { previewBodyAndKindFromWhatsappMirror } from "@/lib/contact-messages/whatsapp-mirror-preview";
import {
  defaultConversationLabel,
} from "@/lib/contact-messages/conversation-thread-key";
import type {
  ContactConversationPreview,
  ContactMessageRow,
} from "@/lib/supabase/contact-messages-db";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";

function previewFromMessage(message: ContactMessageRow): {
  body: string;
  attachmentKind?: ContactMessageAttachmentKind;
} {
  const ext = message.external_source_id ?? "";
  const msgPlatform = messageDisplayPlatform(message);
  if (ext.startsWith("waha:") || msgPlatform === "whatsapp") {
    return previewBodyAndKindFromWhatsappMirror(message.body.trim());
  }
  return {
    body: message.body.trim(),
    attachmentKind: primaryAttachmentKind(
      message.attachments?.map((a) => a.kind),
    ),
  };
}

/** Realtime: eine inbound-Zeile in die Posteingangs-Liste mergen (kein Full-Reload). */
export function patchInboxConversationsFromInboundMessage(
  conversations: ContactConversationPreview[],
  message: ContactMessageRow,
  opts?: { contactName?: string },
): ContactConversationPreview[] {
  if (message.direction !== "inbound") return conversations;

  const threadKey = message.contact_id;
  if (!threadKey) return conversations;

  const mirrored = previewFromMessage(message);
  const msgPlatform = messageDisplayPlatform(message);
  const name =
    opts?.contactName?.trim() ||
    (threadKey.includes(":") ? defaultConversationLabel(threadKey) : "Kontakt");

  const existing = conversations.find((c) => c.contact_id === threadKey);
  const prevWaUnread = existing?.whatsapp_unread_count ?? 0;
  const prevEmUnread = existing?.email_unread_count ?? 0;
  const nextWaUnread =
    msgPlatform === "whatsapp" ? prevWaUnread + 1 : prevWaUnread;
  const nextEmUnread =
    msgPlatform === "email" ? prevEmUnread + 1 : prevEmUnread;
  const nextPreview: ContactConversationPreview = existing
    ? {
        ...existing,
        contact_name: existing.contact_name?.trim() || name,
        last_body: mirrored.body,
        last_at: message.created_at,
        last_direction: "inbound",
        message_count: existing.message_count + 1,
        unread_count: existing.unread_count + 1,
        is_unread: true,
        whatsapp_unread_count:
          msgPlatform === "whatsapp" ? nextWaUnread : existing.whatsapp_unread_count,
        email_unread_count:
          msgPlatform === "email" ? nextEmUnread : existing.email_unread_count,
        last_attachment_kind:
          mirrored.attachmentKind ?? existing.last_attachment_kind,
        last_message_platform: msgPlatform,
        last_inbound_platform: msgPlatform,
        inbound_since_preview: (existing.inbound_since_preview ?? 0) + 1,
        has_reservation_link: Boolean(message.reservation_id),
        last_reservation_id: message.reservation_id ?? null,
      }
    : {
        contact_id: threadKey,
        contact_name: name,
        platform: message.platform,
        last_body: mirrored.body,
        last_at: message.created_at,
        last_direction: "inbound",
        message_count: 1,
        unread_count: 1,
        is_unread: true,
        whatsapp_unread_count: msgPlatform === "whatsapp" ? 1 : undefined,
        email_unread_count: msgPlatform === "email" ? 1 : undefined,
        has_reservation_link: Boolean(message.reservation_id),
        last_reservation_id: message.reservation_id ?? null,
        inbound_since_preview: 1,
        last_attachment_kind: mirrored.attachmentKind,
        last_message_platform: msgPlatform,
        last_inbound_platform: msgPlatform,
      };

  const without = conversations.filter((c) => c.contact_id !== threadKey);
  return [nextPreview, ...without].sort((a, b) =>
    b.last_at.localeCompare(a.last_at),
  );
}

export function patchNotificationSummaryFromInboundMessage(
  summary: import("@/lib/notifications/notification-types").NotificationSummary,
  message: ContactMessageRow,
  opts?: { contactName?: string },
): import("@/lib/notifications/notification-types").NotificationSummary {
  const threadKey = message.contact_id;
  if (!threadKey || message.direction !== "inbound") return summary;

  const name =
    opts?.contactName?.trim() ||
    (threadKey.includes(":") ? defaultConversationLabel(threadKey) : "Kontakt");
  const mirrored = previewFromMessage(message);
  const msgPlatform = messageDisplayPlatform(message);

  const messagesModule = summary.modules.find((m) => m.id === "messages");
  const otherModules = summary.modules.filter((m) => m.id !== "messages");

  const existingItem = messagesModule?.items.find((i) => i.id === threadKey);
  const newItem = {
    id: threadKey,
    title: name,
    subtitle: inboxPreviewSnippet(mirrored.body, mirrored.attachmentKind),
    href: `/dashboard/kontakte/nachrichten?platform=all&contact=${encodeURIComponent(threadKey)}`,
    at: message.created_at,
    meta: { contactId: threadKey, platform: msgPlatform },
  };

  let items = messagesModule?.items ?? [];
  if (existingItem) {
    items = items.filter((i) => i.id !== threadKey);
  }
  items = [newItem, ...items].slice(0, 5);

  const prevCount = messagesModule?.count ?? 0;
  const count = prevCount + 1;

  const messagesMod = {
    id: "messages" as const,
    count,
    label: messagesModule?.label ?? "Nachrichten",
    href: messagesModule?.href ?? "/dashboard/kontakte/nachrichten?platform=all&read=unread",
    items,
  };

  const modules = count > 0 ? [...otherModules, messagesMod] : otherModules;
  return {
    ...summary,
    modules,
    totalCount: modules.reduce((sum, m) => sum + m.count, 0),
  };
}

/** Glocke: notification_events-Payload (contact_messages-Trigger) ohne API. */
export function patchNotificationSummaryFromNotificationPayload(
  summary: import("@/lib/notifications/notification-types").NotificationSummary,
  payload: Record<string, unknown>,
): import("@/lib/notifications/notification-types").NotificationSummary {
  const threadKey =
    typeof payload.contactId === "string" ? payload.contactId.trim() : "";
  if (!threadKey) return summary;

  const name =
    (typeof payload.contactName === "string"
      ? payload.contactName.trim()
      : "") ||
    (threadKey.includes(":") ? defaultConversationLabel(threadKey) : "Kontakt");
  const preview =
    typeof payload.preview === "string" ? payload.preview.trim() : "Nachricht";
  const at =
    typeof payload.messageCreatedAt === "string"
      ? payload.messageCreatedAt
      : new Date().toISOString();
  const platform =
    typeof payload.platform === "string" ? payload.platform : "gwada";

  const messagesModule = summary.modules.find((m) => m.id === "messages");
  const otherModules = summary.modules.filter((m) => m.id !== "messages");

  const existingItem = messagesModule?.items.find((i) => i.id === threadKey);
  const newItem = {
    id: threadKey,
    title: name,
    subtitle: preview,
    href: `/dashboard/kontakte/nachrichten?platform=all&contact=${encodeURIComponent(threadKey)}`,
    at,
    meta: { contactId: threadKey, platform },
  };

  let items = messagesModule?.items ?? [];
  if (existingItem) {
    items = items.filter((i) => i.id !== threadKey);
  }
  items = [newItem, ...items].slice(0, 5);

  const prevCount = messagesModule?.count ?? 0;
  const count = prevCount + 1;

  const messagesMod = {
    id: "messages" as const,
    count,
    label: messagesModule?.label ?? "Nachrichten",
    href:
      messagesModule?.href ??
      "/dashboard/kontakte/nachrichten?platform=all&read=unread",
    items,
  };

  const modules = count > 0 ? [...otherModules, messagesMod] : otherModules;
  return {
    ...summary,
    modules,
    totalCount: modules.reduce((sum, m) => sum + m.count, 0),
  };
}
