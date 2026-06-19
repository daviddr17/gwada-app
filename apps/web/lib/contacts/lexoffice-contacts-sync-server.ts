import "server-only";

import {
  LEXOFFICE_CONTACTS_CACHE_TTL_MS,
  readLexofficeContactsCache,
  upsertLexofficeContactsCache,
} from "@/lib/contacts/lexoffice-contacts-cache-db";
import {
  fetchAllLexofficeContacts,
  type LexofficeContact,
} from "@/lib/integrations/lexoffice-contacts";
import { lexofficeConfigFromJson } from "@/lib/integrations/lexoffice-integration-config";
import { assertPlatformLexofficeEnabled } from "@/lib/integrations/platform-messaging-guard";
import {
  isLexofficeRateLimited,
} from "@/lib/integrations/lexoffice-api-cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantLexofficeConfigAdmin } from "@/lib/supabase/restaurant-lexoffice-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const inFlightSync = new Set<string>();

async function resolveLexofficeApiKeyForSync(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<{ ok: true; apiKey: string } | { ok: false; error: string }> {
  const platform = await assertPlatformLexofficeEnabled(sb);
  if (!platform.ok) {
    return { ok: false, error: "Lexware ist auf Plattform-Ebene deaktiviert." };
  }

  const row = await fetchRestaurantLexofficeConfigAdmin(restaurantId);
  if (!row || row.status !== "working") {
    return { ok: false, error: "Lexware Office ist nicht verbunden." };
  }

  const apiKey = lexofficeConfigFromJson(row.config).api_key?.trim();
  if (!apiKey) {
    return { ok: false, error: "Lexware API-Key fehlt." };
  }

  return { ok: true, apiKey };
}

export async function syncLexofficeContactsCache(
  restaurantId: string,
  apiKey: string,
): Promise<
  | { ok: true; contacts: LexofficeContact[]; count: number }
  | { ok: false; error: string; contacts: LexofficeContact[] }
> {
  if (isLexofficeRateLimited(restaurantId)) {
    return {
      ok: false,
      error: "Lexware Rate-Limit — bitte später erneut.",
      contacts: [],
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", contacts: [] };
  }

  const result = await fetchAllLexofficeContacts(apiKey);
  if (!result.ok) {
    await upsertLexofficeContactsCache(admin, {
      restaurantId,
      contacts: [],
      syncError: result.error,
    });
    return { ok: false, error: result.error, contacts: [] };
  }

  await upsertLexofficeContactsCache(admin, {
    restaurantId,
    contacts: result.contacts,
    syncError: null,
  });

  if (result.contacts.length > 0) {
    console.info(
      `[lexoffice-contacts] ${restaurantId.slice(0, 8)}… cached ${result.contacts.length}`,
    );
  }

  return { ok: true, contacts: result.contacts, count: result.contacts.length };
}

export async function syncLexofficeContactsForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<
  | { ok: true; contacts: LexofficeContact[]; count: number }
  | { ok: false; error: string; contacts: LexofficeContact[] }
> {
  const resolved = await resolveLexofficeApiKeyForSync(sb, restaurantId);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, contacts: [] };
  }
  return syncLexofficeContactsCache(restaurantId, resolved.apiKey);
}

export function triggerLexofficeContactsSyncIfStale(
  restaurantId: string,
): void {
  if (inFlightSync.has(restaurantId)) return;

  void (async () => {
    inFlightSync.add(restaurantId);
    try {
      const admin = createSupabaseAdminClient();
      if (!admin) return;

      const cached = await readLexofficeContactsCache(admin, restaurantId);
      if (cached && !cached.stale) return;

      await syncLexofficeContactsForRestaurant(admin, restaurantId);
    } finally {
      inFlightSync.delete(restaurantId);
    }
  })();
}

export async function syncLexofficeContactsIfStale(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ synced: boolean; count: number; error?: string }> {
  if (inFlightSync.has(restaurantId)) {
    return { synced: false, count: 0 };
  }

  const cached = await readLexofficeContactsCache(admin, restaurantId);
  if (cached && !cached.stale) {
    return { synced: false, count: cached.contacts.length };
  }

  inFlightSync.add(restaurantId);
  try {
    const result = await syncLexofficeContactsForRestaurant(admin, restaurantId);
    if (!result.ok) {
      return { synced: false, count: 0, error: result.error };
    }
    return { synced: true, count: result.count };
  } finally {
    inFlightSync.delete(restaurantId);
  }
}

export { LEXOFFICE_CONTACTS_CACHE_TTL_MS };
