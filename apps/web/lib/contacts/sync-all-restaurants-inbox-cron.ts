import "server-only";

import { syncLexofficeContactsIfStale } from "@/lib/contacts/lexoffice-contacts-sync-server";
import { syncRestaurantEmailInbox } from "@/lib/contacts/sync-restaurant-email-inbox";
import { syncRestaurantWhatsappInbox } from "@/lib/contacts/sync-restaurant-whatsapp-inbox";
import { shouldSyncRestaurantInCronSlot } from "@/lib/ops/cron-restaurant-stagger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactInboxCronStats = {
  restaurants: number;
  skipped: number;
  emailImported: number;
  whatsappImported: number;
  lexofficeContactsSynced: number;
  errors: string[];
};

/** Cron läuft */5 — jedes Restaurant etwa alle 25 Min. */
const INBOX_STAGGER_BUCKETS = 5;

const EMAIL_INBOX_STATUSES = ["custom", "gmail", "outlook"] as const;

async function restaurantIdsWithInbox(
  admin: SupabaseClient,
): Promise<string[]> {
  const [{ data: emailRows, error: emailErr }, { data: waRows, error: waErr }] =
    await Promise.all([
      admin
        .from("restaurant_integrations")
        .select("restaurant_id")
        .eq("integration_key", "email")
        .in("status", [...EMAIL_INBOX_STATUSES]),
      admin
        .from("restaurant_integrations")
        .select("restaurant_id")
        .eq("integration_key", "whatsapp")
        .eq("status", "working"),
    ]);

  if (emailErr) {
    console.warn("[inbox-cron] email integrations", emailErr.message);
  }
  if (waErr) {
    console.warn("[inbox-cron] whatsapp integrations", waErr.message);
  }

  return [
    ...new Set(
      [...(emailRows ?? []), ...(waRows ?? [])]
        .map((r) => (r as { restaurant_id: string }).restaurant_id)
        .filter(Boolean),
    ),
  ];
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
  options?: { forceAll?: boolean },
): Promise<ContactInboxCronStats> {
  const stats: ContactInboxCronStats = {
    restaurants: 0,
    skipped: 0,
    emailImported: 0,
    whatsappImported: 0,
    lexofficeContactsSynced: 0,
    errors: [],
  };

  const restaurantIds = await restaurantIdsWithInbox(admin);
  stats.restaurants = restaurantIds.length;

  for (const restaurantId of restaurantIds) {
    if (
      !options?.forceAll &&
      !shouldSyncRestaurantInCronSlot(restaurantId, INBOX_STAGGER_BUCKETS)
    ) {
      stats.skipped += 1;
      continue;
    }

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
