import "server-only";

import type { LexofficeContact } from "@/lib/integrations/lexoffice-contacts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LexofficeContactsCacheRow = {
  contacts: LexofficeContact[];
  syncedAt: string;
  syncError: string | null;
  stale: boolean;
};

/** Lexoffice-Kontaktliste — Cache-TTL (stille Aktualisierung im Hintergrund). */
export const LEXOFFICE_CONTACTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function readLexofficeContactsCache(
  sb: SupabaseClient,
  restaurantId: string,
  maxAgeMs = LEXOFFICE_CONTACTS_CACHE_TTL_MS,
): Promise<LexofficeContactsCacheRow | null> {
  const { data, error } = await sb
    .from("restaurant_lexoffice_contacts_cache")
    .select("contacts, synced_at, sync_error")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) return null;

  const syncedAt = (data as { synced_at: string }).synced_at;
  const ageMs = Date.now() - new Date(syncedAt).getTime();
  const rawContacts = (data as { contacts: unknown }).contacts;
  const contacts = Array.isArray(rawContacts)
    ? (rawContacts as LexofficeContact[])
    : [];

  return {
    contacts,
    syncedAt,
    syncError: (data as { sync_error: string | null }).sync_error,
    stale: ageMs > maxAgeMs,
  };
}

export async function upsertLexofficeContactsCache(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    contacts: LexofficeContact[];
    syncError?: string | null;
  },
): Promise<void> {
  await admin.from("restaurant_lexoffice_contacts_cache").upsert(
    {
      restaurant_id: params.restaurantId,
      contacts: params.contacts,
      contact_count: params.contacts.length,
      synced_at: new Date().toISOString(),
      sync_error: params.syncError ?? null,
    },
    { onConflict: "restaurant_id" },
  );
}

export async function deleteLexofficeContactsCache(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  await admin
    .from("restaurant_lexoffice_contacts_cache")
    .delete()
    .eq("restaurant_id", restaurantId);
}
