import "server-only";

import { terraLocalizedText } from "@/lib/integrations/tripadvisor-terra-parse";
import { fetchPlatformTripadvisorConfigAdmin } from "@/lib/supabase/platform-tripadvisor-secrets-db";
import { fetchRestaurantTripadvisorConfigAdmin } from "@/lib/supabase/restaurant-tripadvisor-integration-db";

/** Terra Partner API — https://docs.terra.tripadvisor.com */
export const TRIPADVISOR_TERRA_API_BASE = "https://terra.tripadvisor.com/api";

export const TRIPADVISOR_API_VERSION = "1";

/** Faktische Locales (Location/Photos) — siehe Terra locales-Doku. */
export const TRIPADVISOR_DEFAULT_LOCALE = "de-DE";

/** UGC-Sprache für Reviews. */
export const TRIPADVISOR_DEFAULT_LANGUAGE = "de";

type TripadvisorFetchOptions = {
  path: string;
  searchParams?: Record<string, string | number | undefined>;
  locales?: string[];
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
  url.searchParams.set("version", TRIPADVISOR_API_VERSION);

  for (const locale of options.locales ?? []) {
    if (locale) url.searchParams.append("locale", locale);
  }

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
export async function appendTripadvisorAllowlistLocations(
  locationIds: string[],
): Promise<
  | { ok: true; added?: number; noChange?: number }
  | { error: string; status?: number }
> {
  const ids = locationIds
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id))
    .map((id) => Number(id));
  if (ids.length === 0) {
    return { error: "tripadvisor_location_invalid" };
  }

  const platform = await fetchPlatformTripadvisorConfigAdmin();
  if (!platform.enabled) return { error: "tripadvisor_disabled" };
  if (!platform.apiKey) return { error: "tripadvisor_api_key_missing" };

  const postRes = await fetch(`${TRIPADVISOR_TERRA_API_BASE}/allowlist?version=1`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-API-Key": platform.apiKey,
    },
    body: JSON.stringify({
      operation_type: "APPEND",
      allowlist: ids,
    }),
    cache: "no-store",
  });

  const body = (await postRes.json().catch(() => ({}))) as TerraProblemBody & {
    added?: number;
    no_change?: number;
  };
  if (!postRes.ok) {
    return {
      error: tripadvisorErrorMessage(body, postRes.status),
      status: postRes.status,
    };
  }

  return { ok: true, added: body.added, noChange: body.no_change };
}

export async function ensureTripadvisorAllowlistLocation(
  locationId: string,
): Promise<{ ok: true } | { error: string; status?: number }> {
  const result = await appendTripadvisorAllowlistLocations([locationId]);
  if ("error" in result) return result;
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

type TerraCatalogLocationRaw = {
  id?: number;
  name?: string;
  names?: { language?: string; value?: string; primary?: boolean }[];
};

function normalizeCatalogLocation(raw: TerraCatalogLocationRaw): TripadvisorLocationDetails {
  return {
    location_id: raw.id,
    name: terraLocalizedText(raw.names) ?? raw.name?.trim() ?? undefined,
  };
}

export async function fetchTripadvisorCatalogLocation(
  locationId: string,
): Promise<{ location: TripadvisorLocationDetails } | { error: string; status?: number }> {
  const result = await fetchTripadvisorApi<TerraCatalogLocationRaw>({
    path: `/catalog/locations/${encodeURIComponent(locationId)}`,
  });
  if ("error" in result) return result;
  return { location: normalizeCatalogLocation(result.data) };
}

export async function fetchTripadvisorLocationDetails(
  locationId: string,
): Promise<{ location: TripadvisorLocationDetails } | { error: string }> {
  const allowlist = await ensureTripadvisorAllowlistLocation(locationId);
  if ("error" in allowlist && allowlist.status !== 403) {
    return allowlist;
  }

  const result = await fetchTripadvisorApi<TerraLocationRaw>({
    path: `/locations/${encodeURIComponent(locationId)}`,
    locales: [TRIPADVISOR_DEFAULT_LOCALE],
  });
  if (!("error" in result)) {
    return { location: normalizeLocationDetails(result.data) };
  }

  const catalog = await fetchTripadvisorCatalogLocation(locationId);
  if (!("error" in catalog)) {
    return catalog;
  }

  return { error: result.error };
}
