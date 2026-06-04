import "server-only";

import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import { mergeInboxConversationPreviews } from "@/lib/contact-messages/unified-inbox-merge";
import { enrichUnifiedInboxReadStateServer } from "@/lib/contact-messages/unified-inbox-read-state";
import { fetchEmailInboxConversations } from "@/lib/contact-messages/email-inbox-service";
import { fetchWahaInboxConversations } from "@/lib/contact-messages/waha-inbox-service";
import { primaryAttachmentKind } from "@/lib/contact-messages/last-attachment-kind";
import type { ContactMessageAttachmentKind } from "@/lib/types/contact-message-attachment";
import { contactDisplayName } from "@/lib/supabase/contacts-db";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { SupabaseClient } from "@supabase/supabase-js";

async function fetchGwadaConversationsAdmin(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<ContactConversationPreview[]> {
  const { data: messages } = await admin
    .from("contact_messages")
    .select(
      `
      contact_id,
      platform,
      direction,
      body,
      created_at,
      reservation_id,
      external_source_id,
      waha_message_id,
      contacts ( first_name, last_name ),
      contact_message_attachments ( kind )
    `,
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  const previews = new Map<string, ContactConversationPreview>();
  const inboundAfter = new Map<string, number>();
  const lastInboundByContact = new Map<string, ContactMessagePlatform>();

  for (const raw of messages ?? []) {
    const row = raw as Record<string, unknown>;
    const contactId = row.contact_id as string;
    const createdAt = row.created_at as string;
    const direction = row.direction as ContactConversationPreview["last_direction"];
    const platform = row.platform as ContactMessagePlatform;
    const ext = (row.external_source_id as string | null) ?? "";
    const msgPlatform = messageDisplayPlatform({
      id: "",
      restaurant_id: restaurantId,
      contact_id: contactId,
      platform,
      direction,
      body: (row.body as string) ?? "",
      reservation_id: null,
      sent_by: null,
      delivery_status: "sent",
      created_at: createdAt,
      external_source_id: ext || null,
      waha_message_id: (row.waha_message_id as string | null) ?? null,
    });

    if (direction === "inbound") {
      inboundAfter.set(contactId, (inboundAfter.get(contactId) ?? 0) + 1);
      if (!lastInboundByContact.has(contactId)) {
        lastInboundByContact.set(contactId, msgPlatform);
      }
    }

    if (previews.has(contactId)) continue;

    const contactRaw = row.contacts;
    const contact = Array.isArray(contactRaw)
      ? (contactRaw[0] as { first_name: string; last_name: string })
      : (contactRaw as { first_name: string; last_name: string } | null);
    if (!contact) continue;

    const attRaw = row.contact_message_attachments;
    const attKinds: ContactMessageAttachmentKind[] = Array.isArray(attRaw)
      ? attRaw.map((a) => (a as { kind: ContactMessageAttachmentKind }).kind)
      : [];

    previews.set(contactId, {
      contact_id: contactId,
      contact_name: contactDisplayName(contact),
      platform: "gwada",
      last_body: (row.body as string).trim(),
      last_at: createdAt,
      last_direction: direction,
      message_count: 0,
      unread_count: 0,
      is_unread: false,
      has_reservation_link: Boolean(row.reservation_id),
      inbound_since_preview: inboundAfter.get(contactId) ?? 0,
      last_message_platform: msgPlatform,
      last_inbound_platform: lastInboundByContact.get(contactId),
      last_attachment_kind: primaryAttachmentKind(attKinds),
    });
  }

  for (const [id, p] of previews) {
    p.message_count = inboundAfter.get(id) ?? 0;
  }

  return [...previews.values()];
}

export async function fetchUnifiedInboxConversationsServer(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    whatsappConnected: boolean;
    emailConnected: boolean;
  },
): Promise<ContactConversationPreview[]> {
  const sources: ContactConversationPreview[][] = [
    await fetchGwadaConversationsAdmin(admin, params.restaurantId),
  ];

  if (params.whatsappConnected) {
    const { data: wa } = await fetchWahaInboxConversations(
      admin,
      params.restaurantId,
    );
    if (wa?.length) sources.push(wa);
  }

  if (params.emailConnected) {
    const { data: emailConvs } = await fetchEmailInboxConversations(
      admin,
      params.restaurantId,
    );
    if (emailConvs?.length) sources.push(emailConvs);
  }

  const merged = mergeInboxConversationPreviews(sources);
  return enrichUnifiedInboxReadStateServer(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    conversations: merged,
  });
}
