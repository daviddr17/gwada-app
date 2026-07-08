import "server-only";

import { resolveConversationThreadRef } from "@/lib/contact-messages/conversation-thread-key";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import type { SupabaseClient } from "@supabase/supabase-js";

const MIRROR_PREFIX_BY_PLATFORM: Partial<Record<ContactMessagePlatform, string>> =
  {
    email: "email-imap:",
    whatsapp: "waha:",
  };

/** IMAP \\Seen / WAHA-Gelesen für alle eingehenden Spiegel eines Threads setzen. */
export async function setMirrorThreadExternalSeenInDb(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    conversationKey: string;
    platform: "email" | "whatsapp";
    seen: boolean;
  },
): Promise<void> {
  const prefix = MIRROR_PREFIX_BY_PLATFORM[params.platform];
  if (!prefix) return;

  const thread = resolveConversationThreadRef(params.conversationKey);

  let query = admin
    .from("contact_messages")
    .update({ external_seen: params.seen })
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", params.platform)
    .eq("direction", "inbound")
    .like("external_source_id", `${prefix}%`);

  if (thread.contactId) {
    query = query.eq("contact_id", thread.contactId);
  } else if (thread.conversationKey) {
    query = query.eq("conversation_key", thread.conversationKey);
  } else {
    return;
  }

  if (!params.seen) {
    const { data: latest } = await admin
      .from("contact_messages")
      .select("id")
      .eq("restaurant_id", params.restaurantId)
      .eq("platform", params.platform)
      .eq("direction", "inbound")
      .like("external_source_id", `${prefix}%`)
      .match(
        thread.contactId
          ? { contact_id: thread.contactId }
          : { conversation_key: thread.conversationKey! },
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest) return;
    await admin
      .from("contact_messages")
      .update({ external_seen: false })
      .eq("id", (latest as { id: string }).id);
    return;
  }

  await query;
}

/** Einzelne WAHA-Inbound-Nachricht als extern gelesen markieren (Webhook ack). */
export async function setWhatsappMessageExternalSeenInDb(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    wahaMessageId: string;
    seen: boolean;
  },
): Promise<void> {
  const externalSourceId = `waha:${params.wahaMessageId.trim()}`;
  await admin
    .from("contact_messages")
    .update({ external_seen: params.seen })
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", "whatsapp")
    .eq("direction", "inbound")
    .eq("external_source_id", externalSourceId);
}
