import "server-only";

import {
  hashRestaurantApiKeySecret,
  isRestaurantApiKeySecretFormat,
  restaurantApiKeyLookupPrefix,
} from "@/lib/api/restaurant-api-key-crypto";
import type { RestaurantApiModuleId } from "@/lib/api/restaurant-api-modules";
import {
  checkRestaurantApiRateLimit,
  RESTAURANT_API_RATE_LIMIT_PER_MINUTE,
} from "@/lib/api/restaurant-api-rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuthenticatedRestaurantApiKey = {
  keyId: string;
  restaurantId: string;
  slug: string;
  enabledModules: RestaurantApiModuleId[];
  allowedOrigins: string[];
};

type AuthFailure = { ok: false; response: Response };

function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")?.trim();
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function originAllowed(
  request: Request,
  allowedOrigins: string[],
): boolean {
  if (allowedOrigins.length === 0) return true;
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.some((entry) => normalizeOrigin(entry) === normalized);
}

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, string | number>,
): Response {
  return Response.json({ error, ...extra }, { status });
}

export function buildRestaurantApiCorsHeaders(
  request: Request,
  allowedOrigins: string[],
): HeadersInit {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return {};
  if (allowedOrigins.length === 0) {
    return {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    };
  }
  if (originAllowed(request, allowedOrigins)) {
    return {
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    };
  }
  return {};
}

export function handleRestaurantApiPreflight(
  request: Request,
  allowedOrigins: string[] = [],
): Response | null {
  if (request.method !== "OPTIONS") return null;
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  const cors = buildRestaurantApiCorsHeaders(request, allowedOrigins);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return new Response(null, { status: 204, headers });
}

export async function authenticateRestaurantApiKey(
  request: Request,
  module: RestaurantApiModuleId,
): Promise<
  | { ok: true; auth: AuthenticatedRestaurantApiKey }
  | AuthFailure
> {
  const preflight = handleRestaurantApiPreflight(request);
  if (preflight) {
    return { ok: false, response: preflight };
  }

  const secret = parseBearerToken(request);
  if (!secret || !isRestaurantApiKeySecretFormat(secret)) {
    return {
      ok: false,
      response: jsonError(401, "invalid_api_key"),
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, response: jsonError(503, "server_misconfigured") };
  }

  const prefix = restaurantApiKeyLookupPrefix(secret);
  const { data: row, error } = await admin
    .from("restaurant_api_keys")
    .select(
      "id, restaurant_id, key_hash, enabled_modules, allowed_origins, revoked_at",
    )
    .eq("key_prefix", prefix)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, response: jsonError(401, "invalid_api_key") };
  }

  const hash = hashRestaurantApiKeySecret(secret);
  if (hash !== row.key_hash) {
    return { ok: false, response: jsonError(401, "invalid_api_key") };
  }

  const enabledModules = (row.enabled_modules ?? []) as RestaurantApiModuleId[];
  if (!enabledModules.includes(module)) {
    return { ok: false, response: jsonError(403, "module_not_enabled") };
  }

  const allowedOrigins = (row.allowed_origins ?? []) as string[];
  if (!originAllowed(request, allowedOrigins)) {
    return { ok: false, response: jsonError(403, "origin_forbidden") };
  }

  const rate = checkRestaurantApiRateLimit(row.id as string);
  if (!rate.allowed) {
    return {
      ok: false,
      response: Response.json(
        { error: "rate_limit_exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(rate.retryAfterSec),
            "X-RateLimit-Limit": String(RESTAURANT_API_RATE_LIMIT_PER_MINUTE),
          },
        },
      ),
    };
  }

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("slug, is_published")
    .eq("id", row.restaurant_id as string)
    .maybeSingle();

  if (restaurantError || !restaurant?.slug) {
    return { ok: false, response: jsonError(404, "not_found") };
  }

  if (!restaurant.is_published) {
    return { ok: false, response: jsonError(403, "restaurant_not_published") };
  }

  void admin
    .from("restaurant_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id as string);

  return {
    ok: true,
    auth: {
      keyId: row.id as string,
      restaurantId: row.restaurant_id as string,
      slug: restaurant.slug as string,
      enabledModules,
      allowedOrigins,
    },
  };
}

export function restaurantApiJsonResponse(
  request: Request,
  payload: unknown,
  auth: AuthenticatedRestaurantApiKey,
  cacheControl = "public, s-maxage=60, stale-while-revalidate=300",
): Response {
  const headers = new Headers({
    "Cache-Control": cacheControl,
    ...buildRestaurantApiCorsHeaders(request, auth.allowedOrigins),
  });
  return Response.json({ data: payload }, { headers });
}
