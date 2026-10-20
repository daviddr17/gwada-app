import "server-only";

import {
  getMolliePlatformReadyAdmin,
} from "@/lib/integrations/mollie-oauth";
import { refreshMollieAccessToken } from "@/lib/integrations/mollie-oauth";
import {
  mollieConfigFromJson,
} from "@/lib/integrations/platform-mollie-config";
import type { MollieAuth } from "@/lib/mollie/mollie-http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchRestaurantMollieConnectionAdmin,
  saveRestaurantMollieConnectionAdmin,
} from "@/lib/supabase/restaurant-mollie-connection-db";

const EXPIRY_SKEW_MS = 60_000;

export type RestaurantMollieAccess =
  | {
      ok: true;
      auth: MollieAuth;
      profileId: string | null;
      organizationId: string | null;
    }
  | { ok: false; error: string; status: number };

export async function getRestaurantMollieAccess(
  restaurantId: string,
): Promise<RestaurantMollieAccess> {
  const platform = await getMolliePlatformReadyAdmin();
  if (!platform) {
    return { ok: false, error: "mollie_not_configured", status: 503 };
  }

  const { row, error } = await fetchRestaurantMollieConnectionAdmin(restaurantId);
  if (error) return { ok: false, error: "mollie_connection_read_failed", status: 500 };
  if (!row || row.status !== "connected" || !row.access_token?.trim()) {
    return { ok: false, error: "mollie_not_connected", status: 409 };
  }

  const admin = createSupabaseAdminClient();
  const { data: platformRow } = admin
    ? await admin
        .from("platform_integrations")
        .select("config")
        .eq("key", "mollie")
        .maybeSingle()
    : { data: null };
  const config = mollieConfigFromJson(platformRow?.config);
  const testmode = (config.mode ?? "test") === "test";

  let accessToken = row.access_token.trim();
  const expiresAt = row.access_token_expires_at
    ? Date.parse(row.access_token_expires_at)
    : NaN;
  const needsRefresh =
    Number.isFinite(expiresAt) && expiresAt - Date.now() < EXPIRY_SKEW_MS;

  if (needsRefresh && row.refresh_token?.trim()) {
    const refreshed = await refreshMollieAccessToken({
      clientId: platform.clientId,
      clientSecret: platform.clientSecret,
      refreshToken: row.refresh_token.trim(),
    });
    if ("error" in refreshed) {
      return { ok: false, error: "mollie_token_refresh_failed", status: 401 };
    }
    accessToken = refreshed.accessToken;
    const newExpires =
      refreshed.expiresIn != null
        ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
        : null;
    await saveRestaurantMollieConnectionAdmin({
      restaurantId,
      organizationName: row.organization_name,
      organizationId: row.organization_id,
      profileId: row.profile_id,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt: newExpires,
      scope: refreshed.scope,
    });
  }

  return {
    ok: true,
    auth: { kind: "oauth", accessToken, testmode },
    profileId: row.profile_id,
    organizationId: row.organization_id,
  };
}
