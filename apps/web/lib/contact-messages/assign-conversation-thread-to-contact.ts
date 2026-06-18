import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Nach Verknüpfen: DB-Nachrichten vom Pseudo-Thread auf den Kontakt umhängen. */
export async function assignConversationThreadToContact(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contactId: string;
    conversationKey: string;
  },
): Promise<{ updated: number; error: string | null }> {
  const { data, error } = await admin
    .from("contact_messages")
    .update({
      contact_id: params.contactId,
      conversation_key: null,
      conversation_label: null,
    })
    .eq("restaurant_id", params.restaurantId)
    .eq("conversation_key", params.conversationKey)
    .select("id");

  if (error) {
    return { updated: 0, error: error.message };
  }
  return { updated: (data ?? []).length, error: null };
}
