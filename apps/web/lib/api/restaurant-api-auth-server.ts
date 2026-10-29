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
import { recordApiUsageFireAndForget } from "@/lib/insights/restaurant-usage-server";
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
    "Access-Control-Max-Age": "86400",
  });
  const cors = buildRestaurantApiCorsHeaders(request, allowedOrigins);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return new Response(null, { status: 204, headers });
}

export type AuthenticateRestaurantApiKeyOptions = {
  /** Default true. Purchase orders / MCP session auth may skip. */
  requirePublished?: boolean;
  /**
   * When set, require this module in `enabled_modules` and record usage as
   * `api:{module}`. Omit for MCP handshake / tools/list (scope checked per tool).
   */
  module?: RestaurantApiModuleId;
  /** Usage dimension when `module` is omitted (default `mcp`). */
  usageModuleId?: string;
  /** Skip Insights counter (MCP records usage per tools/call / tools/list). */
  skipUsageRecording?: boolean;
};

/**
 * Authenticate a restaurant API key. Optionally enforce a module scope
 * (REST `/api/v1/{module}`). MCP uses the same key without a module, then
 * filters tools by `enabledModules`.
 */
export async function authenticateRestaurantApiKey(
  request: Request,
  moduleOrOptions?: RestaurantApiModuleId | AuthenticateRestaurantApiKeyOptions,
  maybeOptions?: { requirePublished?: boolean },
): Promise<
  | { ok: true; auth: AuthenticatedRestaurantApiKey; isPublished: boolean }
  | AuthFailure
> {
  const options: AuthenticateRestaurantApiKeyOptions =
    typeof moduleOrOptions === "string" || moduleOrOptions === undefined
      ? {
          module: moduleOrOptions,
          requirePublished: maybeOptions?.requirePublished,
        }
      : moduleOrOptions;

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
  if (options.module && !enabledModules.includes(options.module)) {
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

  const isPublished = Boolean(restaurant.is_published);
  if (options.requirePublished !== false && !isPublished) {
    return { ok: false, response: jsonError(403, "restaurant_not_published") };
  }

  void admin
    .from("restaurant_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id as string);

  if (!options.skipUsageRecording) {
    recordApiUsageFireAndForget({
      restaurantId: row.restaurant_id as string,
      moduleId: options.module ?? options.usageModuleId ?? "mcp",
    });
  }

  return {
    ok: true,
    auth: {
      keyId: row.id as string,
      restaurantId: row.restaurant_id as string,
      slug: restaurant.slug as string,
      enabledModules,
      allowedOrigins,
    },
    isPublished,
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
