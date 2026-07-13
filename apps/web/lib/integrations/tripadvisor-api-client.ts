import "server-only";

import { terraLocalizedText } from "@/lib/integrations/tripadvisor-terra-parse";
import { fetchPlatformTripadvisorConfigAdmin } from "@/lib/supabase/platform-tripadvisor-secrets-db";
import { fetchRestaurantTripadvisorConfigAdmin } from "@/lib/supabase/restaurant-tripadvisor-integration-db";

/** Terra Partner API — https://docs.terra.tripadvisor.com */
export const TRIPADVISOR_TERRA_API_BASE = "https://terra.tripadvisor.com/api";

export const TRIPADVISOR_API_VERSION = "1";

export const TRIPADVISOR_DEFAULT_LANGUAGE = "de";

type TripadvisorFetchOptions = {
  path: string;
  searchParams?: Record<string, string | number | undefined>;
  /** Allowlist-Endpoints nutzen version=v1 statt version=1 */
  allowlist?: boolean;
};

type TerraProblemBody = {
  message?: string;
  detail?: string;
  title?: string;
  error?: { message?: string };
};

function tripadvisorErrorMessage(body: TerraProblemBody, status: number): string {
  return (
    body.detail?.trim() ||
    body.message?.trim() ||
    body.title?.trim() ||
    body.error?.message?.trim() ||
    `tripadvisor_${status}`
  );
}

async function tripadvisorFetch(
  apiKey: string,
  options: TripadvisorFetchOptions,
): Promise<Response> {
  const url = new URL(`${TRIPADVISOR_TERRA_API_BASE}${options.path}`);
  url.searchParams.set("version", options.allowlist ? "v1" : TRIPADVISOR_API_VERSION);

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });
}

export async function fetchTripadvisorApi<T>(
  options: TripadvisorFetchOptions,
): Promise<{ data: T } | { error: string; status?: number }> {
  const platform = await fetchPlatformTripadvisorConfigAdmin();
  if (!platform.enabled) return { error: "tripadvisor_disabled" };
  if (!platform.apiKey) return { error: "tripadvisor_api_key_missing" };

  const res = await tripadvisorFetch(platform.apiKey, options);
  const body = (await res.json().catch(() => ({}))) as T & TerraProblemBody;

  if (!res.ok) {
    return { error: tripadvisorErrorMessage(body, res.status), status: res.status };
  }

  return { data: body };
}

/** Terra: Location-ID muss auf der Allowlist stehen, bevor Content-Endpoints Daten liefern. */
export async function ensureTripadvisorAllowlistLocation(
  locationId: string,
): Promise<{ ok: true } | { error: string; status?: number }> {
  const trimmed = locationId.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) {
    return { error: "tripadvisor_location_invalid" };
  }

  const platform = await fetchPlatformTripadvisorConfigAdmin();
  if (!platform.enabled) return { error: "tripadvisor_disabled" };
  if (!platform.apiKey) return { error: "tripadvisor_api_key_missing" };

  const postRes = await fetch(
    `${TRIPADVISOR_TERRA_API_BASE}/allowlist?version=v1&operation=APPEND`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": platform.apiKey,
      },
      body: JSON.stringify([Number(trimmed)]),
      cache: "no-store",
    },
  );

  const body = (await postRes.json().catch(() => ({}))) as TerraProblemBody;
  if (!postRes.ok) {
    return {
      error: tripadvisorErrorMessage(body, postRes.status),
      status: postRes.status,
    };
  }

  return { ok: true };
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

type TerraLocationRaw = {
  id?: number;
  location_id?: number | string;
  name?: string;
  names?: { language?: string; value?: string; primary?: boolean }[];
  rating?: string | number;
  num_reviews?: string | number;
  web_url?: string;
  traveler_ratings?: {
    overall?: { rating?: number; count?: number };
  };
  urls?: {
    tripadvisor?: { main?: string };
    official?: string;
  };
};

function normalizeLocationDetails(raw: TerraLocationRaw): TripadvisorLocationDetails {
  const webUrl =
    raw.urls?.tripadvisor?.main?.trim() ||
    raw.urls?.official?.trim() ||
    raw.web_url?.trim() ||
    undefined;

  return {
    location_id: raw.id ?? raw.location_id,
    name: terraLocalizedText(raw.names) ?? raw.name?.trim() ?? undefined,
    rating: raw.traveler_ratings?.overall?.rating ?? raw.rating,
    num_reviews: raw.traveler_ratings?.overall?.count ?? raw.num_reviews,
    web_url: webUrl,
  };
}

export async function fetchTripadvisorLocationDetails(
  locationId: string,
): Promise<{ location: TripadvisorLocationDetails } | { error: string }> {
  const allowlist = await ensureTripadvisorAllowlistLocation(locationId);
  if ("error" in allowlist) return allowlist;

  const result = await fetchTripadvisorApi<TerraLocationRaw>({
    path: `/locations/${encodeURIComponent(locationId)}`,
    searchParams: { locale: TRIPADVISOR_DEFAULT_LANGUAGE },
  });
  if ("error" in result) return result;
  return { location: normalizeLocationDetails(result.data) };
}
