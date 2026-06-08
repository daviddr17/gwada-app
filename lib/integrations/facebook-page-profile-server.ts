import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { facebookIntegrationConfigFromJson } from "@/lib/integrations/facebook-oauth";
import type { IntegrationPlatformProfile } from "@/lib/integrations/platform-profile-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

type FacebookPageAuthResult =
  | { error: "facebook_not_connected" | "facebook_page_missing" }
  | { pageId: string; token: string };

async function getFacebookPageAuth(
  restaurantId: string,
): Promise<FacebookPageAuthResult> {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => facebookIntegrationConfigFromJson(raw),
  );
  if (!row || row.status !== "working") {
    return { error: "facebook_not_connected" };
  }

  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) {
    return { error: "facebook_page_missing" };
  }

  return { pageId, token };
}

function parseFacebookPagePayload(body: {
  name?: string;
  about?: string;
  phone?: string;
  website?: string;
  single_line_address?: string;
}): IntegrationPlatformProfile {
  return {
    name: body.name?.trim() ?? "",
    description: body.about?.trim() ?? "",
    phone: body.phone?.trim() ?? "",
    website: body.website?.trim() ?? "",
    address: body.single_line_address?.trim() ?? "",
  };
}

export async function fetchFacebookPageProfile(
  restaurantId: string,
): Promise<
  { ok: true; profile: IntegrationPlatformProfile } | { ok: false; error: string }
> {
  const auth = await getFacebookPageAuth(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const params = new URLSearchParams({
    access_token: auth.token,
    fields: "name,about,phone,website,single_line_address",
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.pageId}?${params}`,
    { cache: "no-store" },
  );

  const body = (await res.json().catch(() => ({}))) as {
    name?: string;
    about?: string;
    phone?: string;
    website?: string;
    single_line_address?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.message ?? `facebook_profile_${res.status}`,
    };
  }

  return { ok: true, profile: parseFacebookPagePayload(body) };
}

export async function updateFacebookPageProfile(
  restaurantId: string,
  patch: IntegrationPlatformProfile,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getFacebookPageAuth(restaurantId);
  if ("error" in auth) {
    return { ok: false, error: auth.error };
  }

  const params = new URLSearchParams({
    access_token: auth.token,
    name: patch.name.trim(),
    about: patch.description.trim(),
    phone: patch.phone.trim(),
    website: patch.website.trim(),
    single_line_address: patch.address.trim(),
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.pageId}?${params}`,
    { method: "POST", cache: "no-store" },
  );

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.message ?? `facebook_profile_${res.status}`,
    };
  }

  return { ok: true };
}
