import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import type { IntegrationPlatformProfile } from "@/lib/integrations/platform-profile-types";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

type InstagramBusinessAuthResult =
  | { error: "instagram_not_connected" | "instagram_account_missing" }
  | { igId: string; token: string };

async function getInstagramBusinessAuth(
  restaurantId: string,
): Promise<InstagramBusinessAuthResult> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "instagram",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") {
    return { error: "instagram_not_connected" };
  }

  const igId = row.config.instagram_business_account_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!igId || !token) {
    return { error: "instagram_account_missing" };
  }

  return { igId, token };
}

export async function fetchInstagramBusinessProfile(
  restaurantId: string,
): Promise<
  { ok: true; profile: IntegrationPlatformProfile } | { ok: false; error: string }
> {
  const auth = await getInstagramBusinessAuth(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const params = new URLSearchParams({
    access_token: auth.token,
    fields: "name,biography,website",
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.igId}?${params}`,
    { cache: "no-store" },
  );

  const body = (await res.json().catch(() => ({}))) as {
    name?: string;
    biography?: string;
    website?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.message ?? `instagram_profile_${res.status}`,
    };
  }

  return {
    ok: true,
    profile: {
      name: body.name?.trim() ?? "",
      description: body.biography?.trim() ?? "",
      phone: "",
      website: body.website?.trim() ?? "",
      address: "",
    },
  };
}

export async function updateInstagramBusinessProfile(
  restaurantId: string,
  patch: IntegrationPlatformProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getInstagramBusinessAuth(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const params = new URLSearchParams({
    access_token: auth.token,
    biography: patch.description.trim(),
    website: patch.website.trim(),
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.igId}?${params}`,
    { method: "POST", cache: "no-store" },
  );

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.message ?? `instagram_profile_${res.status}`,
    };
  }

  return { ok: true };
}
