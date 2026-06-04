import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { toFacebookHours } from "@/lib/integrations/opening-hours-platform-format";
import { loadOpeningHoursPayloadAdmin } from "@/lib/integrations/opening-hours-load-server";
import { facebookIntegrationConfigFromJson } from "@/lib/integrations/facebook-oauth";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function syncOpeningHoursToFacebook(
  restaurantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const hoursRes = await loadOpeningHoursPayloadAdmin(admin, restaurantId);
  if ("error" in hoursRes) {
    return { ok: false, error: hoursRes.error };
  }

  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => facebookIntegrationConfigFromJson(raw),
  );
  if (!row || row.status !== "working") {
    return { ok: false, error: "facebook_not_connected" };
  }

  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) {
    return { ok: false, error: "facebook_page_missing" };
  }

  const hours = toFacebookHours(hoursRes.weeklyHours);
  if (Object.keys(hours).length === 0) {
    return { ok: false, error: "no_open_days" };
  }

  const params = new URLSearchParams({
    access_token: token,
    hours: JSON.stringify(hours),
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}?${params}`,
    { method: "POST", cache: "no-store" },
  );

  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.message ?? `facebook_hours_${res.status}`,
    };
  }

  return { ok: true };
}
