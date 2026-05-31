import "server-only";

import { mergeUnreadIntoConversations } from "@/lib/contact-messages/merge-conversation-unread";
import { fetchEmailInboxConversations } from "@/lib/contact-messages/email-inbox-service";
import { fetchWahaInboxConversations } from "@/lib/contact-messages/waha-inbox-service";
import { fetchConversationReadsForUser } from "@/lib/supabase/contact-conversation-reads-db";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";

export type { MessagesUnreadSummary } from "@/lib/contact-messages/messages-unread-summary";

async function gwadaConversationsFromDb(
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
      contacts ( first_name, last_name )
    `,
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  const previews = new Map<string, ContactConversationPreview>();
  const inboundAfter = new Map<string, number>();

  for (const raw of messages ?? []) {
    const row = raw as Record<string, unknown>;
    const contactId = row.contact_id as string;
    const createdAt = row.created_at as string;
    const direction = row.direction as ContactConversationPreview["last_direction"];

    if (direction === "inbound") {
      inboundAfter.set(contactId, (inboundAfter.get(contactId) ?? 0) + 1);
    }

    if (previews.has(contactId)) continue;

    const contactRaw = row.contacts;
    const contact = Array.isArray(contactRaw)
      ? (contactRaw[0] as { first_name: string; last_name: string })
      : (contactRaw as { first_name: string; last_name: string } | null);
    if (!contact) continue;

    const name = `${contact.first_name} ${contact.last_name}`.trim() || "Unbenannt";
    previews.set(contactId, {
      contact_id: contactId,
      contact_name: name,
      platform: "gwada",
      last_body: (row.body as string).trim(),
      last_at: createdAt,
      last_direction: direction,
      message_count: 0,
      unread_count: 0,
      is_unread: false,
      has_reservation_link: Boolean(row.reservation_id),
      inbound_since_preview: inboundAfter.get(contactId) ?? 0,
    });
  }

  for (const [id, p] of previews) {
    p.message_count = inboundAfter.get(id) ?? 0;
  }

  return [...previews.values()];
}

function sumUnread(list: ContactConversationPreview[]): number {
  return list.reduce((acc, c) => acc + (c.is_unread ? c.unread_count : 0), 0);
}

export async function fetchMessagesUnreadSummary(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    whatsappConnected: boolean;
    emailConnected: boolean;
  },
): Promise<MessagesUnreadSummary> {
  const readsGwada = await fetchConversationReadsForUser(admin, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    platform: "gwada",
  });

  const gwadaRaw = await gwadaConversationsFromDb(admin, params.restaurantId);
  const gwada = mergeUnreadIntoConversations(gwadaRaw, readsGwada, "gwada");
  let gwada_unread = sumUnread(gwada);
  let whatsapp_unread = 0;
  let email_unread = 0;

  if (params.whatsappConnected) {
    const readsWa = await fetchConversationReadsForUser(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      platform: "whatsapp",
    });
    const { data: wa } = await fetchWahaInboxConversations(
      admin,
      params.restaurantId,
    );
    const merged = mergeUnreadIntoConversations(wa ?? [], readsWa, "whatsapp");
    whatsapp_unread = sumUnread(merged);
  }

  if (params.emailConnected) {
    const readsEmail = await fetchConversationReadsForUser(admin, {
      restaurantId: params.restaurantId,
      userId: params.userId,
      platform: "email",
    });
    const { data: emailConvs } = await fetchEmailInboxConversations(
      admin,
      params.restaurantId,
    );
    const mergedEmail = mergeUnreadIntoConversations(
      emailConvs ?? [],
      readsEmail,
      "email",
    );
    email_unread = sumUnread(mergedEmail);
  }

  return {
    total_unread: gwada_unread + whatsapp_unread + email_unread,
    gwada_unread,
    whatsapp_unread,
    email_unread,
  };
}

export async function isWhatsappConfigured(): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
  return Boolean(config);
}
