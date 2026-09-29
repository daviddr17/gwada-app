import "server-only";

import type { AdyenPlatformEnv } from "@/lib/integrations/platform-adyen-config";
import type { AdyenConnectionSecrets } from "@/lib/integrations/adyen-connect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdyenConnectionRow = AdyenConnectionSecrets & {
  restaurant_id: string;
};

function missingRelation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

export async function fetchRestaurantAdyenConnectionAdmin(
  restaurantId: string,
): Promise<{ row: AdyenConnectionRow | null; error: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { row: null, error: "server_misconfigured" };
  const { data, error } = await admin
    .from("restaurant_adyen_connections")
    .select(
      "restaurant_id, status, env, legal_name, legal_entity_id, account_holder_id, balance_account_id, connected_at",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) {
    if (missingRelation(error)) return { row: null, error: null };
    return { row: null, error: "Adyen-Verbindung konnte nicht gelesen werden." };
  }
  return { row: (data as AdyenConnectionRow | null) ?? null, error: null };
}

export async function saveRestaurantAdyenConnectionAdmin(input: {
  restaurantId: string;
  status: "connected" | "disconnected";
  env: AdyenPlatformEnv;
  legalName: string | null;
  legalEntityId: string | null;
  accountHolderId: string | null;
  balanceAccountId: string | null;
  connectedAt: string | null;
}): Promise<{ error: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };
  const { error } = await admin.from("restaurant_adyen_connections").upsert(
    {
      restaurant_id: input.restaurantId,
      status: input.status,
      env: input.env,
      legal_name: input.legalName,
      legal_entity_id: input.legalEntityId,
      account_holder_id: input.accountHolderId,
      balance_account_id: input.balanceAccountId,
      connected_at: input.connectedAt,
    },
    { onConflict: "restaurant_id" },
  );
  if (error) return { error: "Adyen-Verbindung konnte nicht gespeichert werden." };
  return { error: null };
}

export async function disconnectRestaurantAdyenAdmin(
  restaurantId: string,
): Promise<{ error: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };
  const existing = await fetchRestaurantAdyenConnectionAdmin(restaurantId);
  if (existing.error) return { error: existing.error };
  if (!existing.row) return { error: null };
  return saveRestaurantAdyenConnectionAdmin({
    restaurantId,
    status: "disconnected",
    env: existing.row.env === "live" ? "live" : "test",
    legalName: existing.row.legal_name,
    legalEntityId: existing.row.legal_entity_id,
    accountHolderId: existing.row.account_holder_id,
    balanceAccountId: existing.row.balance_account_id,
    connectedAt: null,
  });
}
