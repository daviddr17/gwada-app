import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OAuthPendingProvider = "facebook" | "instagram" | "google_business";

const PENDING_TTL_SEC = 15 * 60;

export async function createOAuthIntegrationPending(params: {
  provider: OAuthPendingProvider;
  restaurantId: string;
  payload: unknown;
}): Promise<{ id: string } | { error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "admin_unavailable" };

  const expiresAt = new Date(Date.now() + PENDING_TTL_SEC * 1000).toISOString();

  const { data, error } = await admin
    .from("oauth_integration_pending")
    .insert({
      provider: params.provider,
      restaurant_id: params.restaurantId,
      payload: params.payload,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { error: error?.message ?? "insert_failed" };
  }

  return { id: data.id as string };
}

export async function loadOAuthIntegrationPending<T>(
  id: string,
): Promise<{ row: { provider: OAuthPendingProvider; restaurantId: string; payload: T } } | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("oauth_integration_pending")
    .select("provider, restaurant_id, payload, expires_at")
    .eq("id", id.trim())
    .maybeSingle();

  if (error || !data) return null;

  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    await admin.from("oauth_integration_pending").delete().eq("id", id);
    return null;
  }

  return {
    row: {
      provider: data.provider as OAuthPendingProvider,
      restaurantId: data.restaurant_id as string,
      payload: data.payload as T,
    },
  };
}

export async function deleteOAuthIntegrationPending(id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.from("oauth_integration_pending").delete().eq("id", id.trim());
}
