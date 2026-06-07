"use client";

import { mergeUnreadIntoConversations } from "@/lib/contact-messages/merge-conversation-unread";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { fetchConversationReadsBrowser } from "@/lib/supabase/contact-conversation-reads-db";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function enrichConversationsWithReadState(params: {
  restaurantId: string;
  platform: ContactMessagePlatform;
  conversations: ContactConversationPreview[];
}): Promise<ContactConversationPreview[]> {
  const sb = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return params.conversations;

  const reads = await fetchConversationReadsBrowser({
    restaurantId: params.restaurantId,
    userId: user.id,
    platform: params.platform,
  });

  return mergeUnreadIntoConversations(
    params.conversations,
    reads,
    params.platform,
  );
}
