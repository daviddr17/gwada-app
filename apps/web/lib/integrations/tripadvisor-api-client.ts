import "server-only";

import { fetchPlatformTripadvisorConfigAdmin } from "@/lib/supabase/platform-tripadvisor-secrets-db";
import { fetchRestaurantTripadvisorConfigAdmin } from "@/lib/supabase/restaurant-tripadvisor-integration-db";

/** Terra API v1 — siehe https://docs.terra.tripadvisor.com */
export const TRIPADVISOR_TERRA_API_BASE = "https://api.tripadvisor.com/v1";

export const TRIPADVISOR_DEFAULT_LANGUAGE = "de";

type TripadvisorFetchOptions = {
  path: string;
  searchParams?: Record<string, string | number | undefined>;
};

export async function fetchTripadvisorApi<T>(
  options: TripadvisorFetchOptions,
): Promise<{ data: T } | { error: string; status?: number }> {
  const platform = await fetchPlatformTripadvisorConfigAdmin();
  if (!platform.enabled) return { error: "tripadvisor_disabled" };
  if (!platform.apiKey) return { error: "tripadvisor_api_key_missing" };

  const url = new URL(`${TRIPADVISOR_TERRA_API_BASE}${options.path}`);
  url.searchParams.set("language", TRIPADVISOR_DEFAULT_LANGUAGE);
  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-API-KEY": platform.apiKey,
    },
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    detail?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    const message =
      body.detail ??
      body.message ??
      body.error?.message ??
      `tripadvisor_${res.status}`;
    return { error: message, status: res.status };
  }

  return { data: body };
}

export async function getTripadvisorLocationIdForRestaurant(
  restaurantId: string,
): Promise<{ locationId: string } | { error: string }> {
  const row = await fetchRestaurantTripadvisorConfigAdmin(restaurantId);
  if (!row || row.status !== "working") {
    return { error: "tripadvisor_not_connected" };
  }
  const locationId = row.config.location_id?.trim();
  if (!locationId) return { error: "tripadvisor_location_missing" };
  return { locationId };
}

export type TripadvisorLocationDetails = {
  location_id?: number | string;
  name?: string;
  rating?: string | number;
  num_reviews?: string | number;
  web_url?: string;
};

export async function fetchTripadvisorLocationDetails(
  locationId: string,
): Promise<{ location: TripadvisorLocationDetails } | { error: string }> {
  const result = await fetchTripadvisorApi<TripadvisorLocationDetails>({
    path: `/locations/${encodeURIComponent(locationId)}`,
  });
  if ("error" in result) return result;
  return { location: result.data };
}
