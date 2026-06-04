import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import { fromFacebookPageHours } from "@/lib/integrations/opening-hours-platform-format";
import { facebookIntegrationConfigFromJson } from "@/lib/integrations/facebook-oauth";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import type { DayHours, Weekday } from "@/lib/types/restaurant";

export async function fetchFacebookPageHours(
  restaurantId: string,
): Promise<
  | { ok: true; weeklyHours: Record<Weekday, DayHours> }
  | { ok: false; error: string }
> {
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

  const params = new URLSearchParams({
    access_token: token,
    fields: "hours",
  });

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}?${params}`,
    { cache: "no-store" },
  );

  const body = (await res.json().catch(() => ({}))) as {
    hours?: Record<string, Array<{ open?: string; close?: string }>>;
    error?: { message?: string };
  };

  if (!res.ok) {
    return {
      ok: false,
      error: body.error?.message ?? `facebook_fetch_${res.status}`,
    };
  }

  return {
    ok: true,
    weeklyHours: fromFacebookPageHours(body.hours ?? null),
  };
}
