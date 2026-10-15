import "server-only";

import {
  needsWahaDisplayNameResolve,
  sanitizeConversationLabelForStorage,
} from "@/lib/contact-messages/waha-chat-label";
import {
  isWahaPseudoContactId,
  wahaPseudoContactIdFromChatId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persist a readable WAHA business/push name onto pseudo-thread rows so the
 * DB-backed inbox shows the company name instead of a phone number.
 */
export async function persistWahaConversationDisplayLabel(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    chatId?: string | null;
    conversationKey?: string | null;
    label: string | null | undefined;
  },
): Promise<{ updated: boolean; label: string | null }> {
  const label = sanitizeConversationLabelForStorage(params.label);
  if (!label) return { updated: false, label: null };

  const conversationKey =
    params.conversationKey?.trim() ||
    (params.chatId?.trim()
      ? wahaPseudoContactIdFromChatId(params.chatId.trim())
      : "");
  if (!conversationKey || !isWahaPseudoContactId(conversationKey)) {
    return { updated: false, label };
  }

  const { data: rows, error: selectError } = await admin
    .from("contact_messages")
    .select("id, conversation_label")
    .eq("restaurant_id", params.restaurantId)
    .eq("conversation_key", conversationKey)
    .limit(200);

  if (selectError) {
    console.warn(
      "[waha-display-name] select conversation_label",
      selectError.message,
    );
    return { updated: false, label };
  }

  const ids = (rows ?? [])
    .filter((row) => {
      const current = (row.conversation_label as string | null)?.trim() ?? "";
      if (!current) return true;
      if (current === label) return false;
      return needsWahaDisplayNameResolve(current);
    })
    .map((row) => row.id as string);

  if (ids.length === 0) return { updated: false, label };

  const { error } = await admin
    .from("contact_messages")
    .update({ conversation_label: label })
    .eq("restaurant_id", params.restaurantId)
    .in("id", ids);

  if (error) {
    console.warn(
      "[waha-display-name] persist conversation_label",
      error.message,
    );
    return { updated: false, label };
  }

  return { updated: true, label };
}
