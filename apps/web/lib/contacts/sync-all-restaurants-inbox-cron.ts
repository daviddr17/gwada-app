import "server-only";

import { syncRestaurantEmailInbox } from "@/lib/contacts/sync-restaurant-email-inbox";
import { syncContactWhatsappInbound } from "@/lib/contacts/sync-contact-whatsapp-inbound";
import { fetchWahaInboxConversations } from "@/lib/contact-messages/waha-inbox-service";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { fetchRestaurantEmailSmtpConfig } from "@/lib/supabase/restaurant-email-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactInboxCronStats = {
  restaurants: number;
  emailImported: number;
  whatsappImported: number;
  errors: string[];
};

async function restaurantIdsWithInbox(
  admin: SupabaseClient,
): Promise<string[]> {
  const { data: restaurants } = await admin.from("restaurants").select("id");
  const ids: string[] = [];
  const wahaConfig = await getWahaServerConfigAdmin();

  for (const r of restaurants ?? []) {
    const id = (r as { id: string }).id;
    const email = await fetchRestaurantEmailSmtpConfig(admin, id);
    if (email?.status === "custom") {
      ids.push(id);
      continue;
    }
    if (wahaConfig) {
      const session = wahaSessionNameForRestaurant(id);
      const res = await wahaGetSession(wahaConfig, session);
      if (res.ok && res.data?.status === "WORKING") {
        ids.push(id);
      }
    }
  }

  return [...new Set(ids)];
}

export async function runContactInboxSyncCron(
  admin: SupabaseClient,
): Promise<ContactInboxCronStats> {
  const stats: ContactInboxCronStats = {
    restaurants: 0,
    emailImported: 0,
    whatsappImported: 0,
    errors: [],
  };

  const restaurantIds = await restaurantIdsWithInbox(admin);
  stats.restaurants = restaurantIds.length;

  for (const restaurantId of restaurantIds) {
    const email = await syncRestaurantEmailInbox(admin, restaurantId);
    if (email.error) stats.errors.push(`${restaurantId}:email:${email.error}`);
    stats.emailImported += email.imported;

    const wahaConfig = await getWahaServerConfigAdmin();
    if (!wahaConfig) continue;

    const session = wahaSessionNameForRestaurant(restaurantId);
    const sessionRes = await wahaGetSession(wahaConfig, session);
    if (!sessionRes.ok || sessionRes.data?.status !== "WORKING") continue;

    const conv = await fetchWahaInboxConversations(admin, restaurantId);
    if (conv.error) {
      stats.errors.push(`${restaurantId}:waha:${conv.error}`);
      continue;
    }

    const syncedContacts = new Set<string>();
    for (const c of conv.data) {
      const contactId = c.contact_id;
      if (!contactId || contactId.startsWith("waha:") || contactId.startsWith("email:")) {
        continue;
      }
      if (syncedContacts.has(contactId)) continue;
      syncedContacts.add(contactId);

      const wa = await syncContactWhatsappInbound(admin, {
        restaurantId,
        contactId,
      });
      if (wa.error && wa.error !== "no_whatsapp_chat") {
        stats.errors.push(`${restaurantId}:wa:${contactId}:${wa.error}`);
      }
      stats.whatsappImported += wa.imported;
    }
  }

  return stats;
}
