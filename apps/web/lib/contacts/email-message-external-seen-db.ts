import "server-only";

import { resolveConversationThreadRef } from "@/lib/contact-messages/conversation-thread-key";
import type { SupabaseClient } from "@supabase/supabase-js";

const EMAIL_IMAP_EXTERNAL_PREFIX = "email-imap:";

/** IMAP-\\Seen für alle eingehenden E-Mail-Spiegel eines Threads setzen. */
export async function setEmailThreadExternalSeenInDb(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    conversationKey: string;
    seen: boolean;
  },
): Promise<void> {
  const thread = resolveConversationThreadRef(params.conversationKey);

  let query = admin
    .from("contact_messages")
    .update({ external_seen: params.seen })
    .eq("restaurant_id", params.restaurantId)
    .eq("platform", "email")
    .eq("direction", "inbound")
    .like("external_source_id", `${EMAIL_IMAP_EXTERNAL_PREFIX}%`);

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
      .eq("platform", "email")
      .eq("direction", "inbound")
      .like("external_source_id", `${EMAIL_IMAP_EXTERNAL_PREFIX}%`)
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
