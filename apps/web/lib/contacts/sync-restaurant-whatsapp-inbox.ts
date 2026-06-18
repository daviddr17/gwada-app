import "server-only";

import { fetchWahaInboxConversations } from "@/lib/contact-messages/waha-inbox-service";
import { isWahaPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import {
  syncContactWhatsappInbound,
  syncPseudoWhatsappThread,
} from "@/lib/contacts/sync-contact-whatsapp-inbound";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import { wahaGetSession } from "@/lib/waha/waha-client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** WAHA-Verlauf für verknüpfte und unverknüpfte Chats in die DB spiegeln. */
export async function syncRestaurantWhatsappInbox(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ imported: number; error: string | null }> {
  const wahaConfig = await getWahaServerConfigAdmin();
  if (!wahaConfig) return { imported: 0, error: null };

  const session = wahaSessionNameForRestaurant(restaurantId);
  const sessionRes = await wahaGetSession(wahaConfig, session);
  if (!sessionRes.ok || sessionRes.data?.status !== "WORKING") {
    return { imported: 0, error: null };
  }

  const conv = await fetchWahaInboxConversations(admin, restaurantId);
  if (conv.error) {
    return { imported: 0, error: conv.error };
  }

  let imported = 0;
  const syncedThreads = new Set<string>();

  for (const c of conv.data) {
    const threadKey = c.contact_id;
    if (!threadKey || threadKey.startsWith("email:")) continue;
    if (syncedThreads.has(threadKey)) continue;
    syncedThreads.add(threadKey);

    const wa = isWahaPseudoContactId(threadKey)
      ? await syncPseudoWhatsappThread(admin, {
          restaurantId,
          conversationKey: threadKey,
        })
      : await syncContactWhatsappInbound(admin, {
          restaurantId,
          contactId: threadKey,
        });

    if (wa.error && wa.error !== "no_whatsapp_chat") {
      return { imported, error: wa.error };
    }
    imported += wa.imported;
  }

  return { imported, error: null };
}
