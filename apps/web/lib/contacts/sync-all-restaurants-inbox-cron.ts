import "server-only";

import { syncLexofficeContactsIfStale } from "@/lib/contacts/lexoffice-contacts-sync-server";
import { syncRestaurantEmailInbox } from "@/lib/contacts/sync-restaurant-email-inbox";
import { syncRestaurantWhatsappInbox } from "@/lib/contacts/sync-restaurant-whatsapp-inbox";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import { fetchRestaurantEmailSmtpConfig } from "@/lib/supabase/restaurant-email-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactInboxCronStats = {
  restaurants: number;
  emailImported: number;
  whatsappImported: number;
  lexofficeContactsSynced: number;
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

async function restaurantIdsWithLexoffice(
  admin: SupabaseClient,
): Promise<string[]> {
  const { data } = await admin
    .from("restaurant_integrations")
    .select("restaurant_id")
    .eq("integration_key", "lexoffice")
    .eq("status", "working");

  return (data ?? []).map((r) => (r as { restaurant_id: string }).restaurant_id);
}

export async function runContactInboxSyncCron(
  admin: SupabaseClient,
): Promise<ContactInboxCronStats> {
  const stats: ContactInboxCronStats = {
    restaurants: 0,
    emailImported: 0,
    whatsappImported: 0,
    lexofficeContactsSynced: 0,
    errors: [],
  };

  const restaurantIds = await restaurantIdsWithInbox(admin);
  stats.restaurants = restaurantIds.length;

  for (const restaurantId of restaurantIds) {
    const email = await syncRestaurantEmailInbox(admin, restaurantId);
    if (email.error) stats.errors.push(`${restaurantId}:email:${email.error}`);
    stats.emailImported += email.imported;

    const wa = await syncRestaurantWhatsappInbox(admin, restaurantId);
    if (wa.error) {
      stats.errors.push(`${restaurantId}:waha:${wa.error}`);
    }
    stats.whatsappImported += wa.imported;
  }

  for (const restaurantId of await restaurantIdsWithLexoffice(admin)) {
    const lex = await syncLexofficeContactsIfStale(admin, restaurantId);
    if (lex.error) {
      stats.errors.push(`${restaurantId}:lexoffice:${lex.error}`);
    }
    if (lex.synced) {
      stats.lexofficeContactsSynced += lex.count;
    }
  }

  return stats;
}
