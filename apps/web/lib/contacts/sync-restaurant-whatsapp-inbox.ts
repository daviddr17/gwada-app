import "server-only";

import { fetchWahaInboxConversations } from "@/lib/contact-messages/waha-inbox-service";
import { isWahaPseudoContactId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import {
  syncContactWhatsappInbound,
  syncPseudoWhatsappThread,
} from "@/lib/contacts/sync-contact-whatsapp-inbound";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import { wahaGetSession } from "@/lib/waha/waha-client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cron: nur wenige aktuelle Chats — kein voller Verlauf. */
const CRON_OVERVIEW_LIMIT = 15;
/** Pro Chat: nur die neuesten Nachrichten (Webhook-Catch-up). */
const CRON_MAX_MESSAGES_PER_THREAD = 5;
/** Älter als dieses Fenster nicht nachziehen (verhindert Alt-Dumps nach Recover). */
const CRON_CATCHUP_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/**
 * WAHA-Verlauf für verknüpfte und unverknüpfte Chats in die DB spiegeln.
 * Cron-Catch-up: silent, limitiert, nur jüngere Nachrichten — Live kommt über Webhooks.
 */
export async function syncRestaurantWhatsappInbox(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ imported: number; error: string | null }> {
  const wahaConfig = await getWahaServerConfigForRestaurantAdmin(restaurantId);
  if (!wahaConfig) return { imported: 0, error: null };

  const session = wahaSessionNameForRestaurant(restaurantId);
  const sessionRes = await wahaGetSession(wahaConfig, session);
  if (!sessionRes.ok || sessionRes.data?.status !== "WORKING") {
    return { imported: 0, error: null };
  }

  const conv = await fetchWahaInboxConversations(admin, restaurantId, {
    skipDisplayNameResolve: true,
    overviewLimit: CRON_OVERVIEW_LIMIT,
  });
  if (conv.error) {
    return { imported: 0, error: conv.error };
  }

  const minCreatedAtMs = Date.now() - CRON_CATCHUP_MAX_AGE_MS;
  let imported = 0;
  const syncedThreads = new Set<string>();

  for (const c of conv.data.slice(0, CRON_OVERVIEW_LIMIT)) {
    const threadKey = c.contact_id;
    if (!threadKey || threadKey.startsWith("email:")) continue;
    if (syncedThreads.has(threadKey)) continue;
    syncedThreads.add(threadKey);

    const wa = isWahaPseudoContactId(threadKey)
      ? await syncPseudoWhatsappThread(admin, {
          restaurantId,
          conversationKey: threadKey,
          maxMessages: CRON_MAX_MESSAGES_PER_THREAD,
          conversationLabel: c.contact_name,
          silent: true,
          minCreatedAtMs,
        })
      : await syncContactWhatsappInbound(admin, {
          restaurantId,
          contactId: threadKey,
          maxMessages: CRON_MAX_MESSAGES_PER_THREAD,
          silent: true,
          minCreatedAtMs,
        });

    if (wa.error && wa.error !== "no_whatsapp_chat") {
      return { imported, error: wa.error };
    }
    imported += wa.imported;
  }

  return { imported, error: null };
}
