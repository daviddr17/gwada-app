import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { MollieConnectionSecrets } from "@/lib/integrations/mollie-connect";

export type MollieConnectionRow = MollieConnectionSecrets & {
  restaurant_id: string;
  access_token_expires_at: string | null;
  scope: string | null;
};

function missingRelation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

export async function fetchRestaurantMollieConnectionAdmin(
  restaurantId: string,
): Promise<{ row: MollieConnectionRow | null; error: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { row: null, error: "server_misconfigured" };
  const { data, error } = await admin
    .from("restaurant_mollie_connections")
    .select(
      "restaurant_id, status, organization_name, organization_id, profile_id, access_token, refresh_token, access_token_expires_at, scope, connected_at",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) {
    if (missingRelation(error)) return { row: null, error: null };
    return { row: null, error: "Mollie-Verbindung konnte nicht gelesen werden." };
  }
  return { row: (data as MollieConnectionRow | null) ?? null, error: null };
}

export async function saveRestaurantMollieConnectionAdmin(input: {
  restaurantId: string;
  organizationName: string | null;
  organizationId: string | null;
  profileId: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string;
}): Promise<{ error: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };
  const { error } = await admin.from("restaurant_mollie_connections").upsert(
    {
      restaurant_id: input.restaurantId,
      status: "connected",
      organization_name: input.organizationName,
      organization_id: input.organizationId,
      profile_id: input.profileId,
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
      access_token_expires_at: input.expiresAt,
      scope: input.scope,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "restaurant_id" },
  );
  if (error) return { error: "Mollie-Verbindung konnte nicht gespeichert werden." };
  return { error: null };
}

export async function disconnectRestaurantMollieAdmin(
  restaurantId: string,
): Promise<{ error: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };
  const { error } = await admin
    .from("restaurant_mollie_connections")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (error) {
    if (missingRelation(error)) return { error: null };
    return { error: "Mollie konnte nicht getrennt werden." };
  }
  return { error: null };
}
