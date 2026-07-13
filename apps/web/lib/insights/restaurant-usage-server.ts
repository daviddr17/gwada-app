import "server-only";

import { checkInMemoryRateLimit } from "@/lib/api/in-memory-rate-limit";
import { getRequestClientIp } from "@/lib/api/request-client-ip";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isRestaurantUsageDimension,
  isRestaurantUsageSource,
  type RestaurantUsageSource,
} from "@/lib/insights/restaurant-usage-constants";

const BOT_UA =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegram|discordbot|slackbot|linkedinbot|twitterbot|applebot|semrush|ahrefs|petalbot|bytespider|gptbot|claudebot|google-inspection|headlesschrome|phantomjs|selenium|puppeteer/i;

export function isLikelyBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_UA.test(userAgent);
}

function utcDayYmd(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Pro Session+Dimension höchstens 1 Zählung / 24h (nur In-Memory, keine Persistenz). */
function sessionDedupAllowed(params: {
  restaurantId: string;
  source: RestaurantUsageSource;
  dimension: string;
  sessionId: string;
  dayYmd: string;
}): boolean {
  const key = `usage-dedup:${params.dayYmd}:${params.restaurantId}:${params.source}:${params.dimension}:${params.sessionId}`;
  const check = checkInMemoryRateLimit(key, 1, 24 * 60 * 60 * 1000);
  return check.allowed;
}

/** IP nur für Rate-Limit (nie speichern). */
export function enforceUsageBeaconRateLimit(request: Request): Response | null {
  const ip = getRequestClientIp(request);
  const check = checkInMemoryRateLimit(`usage-beacon:ip:${ip}`, 60, 60_000);
  if (!check.allowed) {
    return Response.json(
      { error: "rate_limit_exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(check.retryAfterSec),
          "Cache-Control": "no-store",
        },
      },
    );
  }
  return null;
}

export async function incrementRestaurantUsageDaily(params: {
  restaurantId: string;
  source: RestaurantUsageSource;
  dimension: string;
  delta?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isRestaurantUsageSource(params.source)) {
    return { ok: false, error: "invalid_source" };
  }
  if (!isRestaurantUsageDimension(params.dimension)) {
    return { ok: false, error: "invalid_dimension" };
  }
  const delta = params.delta ?? 1;
  if (!Number.isInteger(delta) || delta < 1 || delta > 100) {
    return { ok: false, error: "invalid_delta" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const { error } = await admin.rpc("increment_restaurant_usage_daily", {
    p_restaurant_id: params.restaurantId,
    p_day: utcDayYmd(),
    p_source: params.source,
    p_dimension: params.dimension,
    p_delta: delta,
  });

  if (error) {
    console.warn("increment_restaurant_usage_daily", error.message);
    return { ok: false, error: "increment_failed" };
  }
  return { ok: true };
}

/**
 * Öffentlicher Beacon: 1× pro Session/Tag/Dimension.
 * Keine IPs persistieren — nur Aggregat erhöhen.
 */
export async function recordUsageBeaconEvent(params: {
  request: Request;
  restaurantId: string;
  source: RestaurantUsageSource;
  dimension: string;
  sessionId: string;
}): Promise<{ ok: true; counted: boolean } | { ok: false; error: string; status: number }> {
  const ua = params.request.headers.get("user-agent");
  if (isLikelyBotUserAgent(ua)) {
    return { ok: true, counted: false };
  }

  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(params.sessionId)) {
    return { ok: false, error: "invalid_session", status: 400 };
  }

  if (!isRestaurantUsageSource(params.source)) {
    return { ok: false, error: "invalid_source", status: 400 };
  }
  if (!isRestaurantUsageDimension(params.dimension)) {
    return { ok: false, error: "invalid_dimension", status: 400 };
  }

  const dayYmd = utcDayYmd();
  const allowed = sessionDedupAllowed({
    restaurantId: params.restaurantId,
    source: params.source,
    dimension: params.dimension,
    sessionId: params.sessionId,
    dayYmd,
  });
  if (!allowed) {
    return { ok: true, counted: false };
  }

  const result = await incrementRestaurantUsageDaily({
    restaurantId: params.restaurantId,
    source: params.source,
    dimension: params.dimension,
  });
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 };
  }
  return { ok: true, counted: true };
}

/** API-Nutzung: jedes erfolgreiche Auth zählt (kein Session-Dedup). */
export function recordApiUsageFireAndForget(params: {
  restaurantId: string;
  moduleId: string;
}): void {
  const dimension = `api:${params.moduleId}`;
  if (!isRestaurantUsageDimension(dimension)) return;
  void incrementRestaurantUsageDaily({
    restaurantId: params.restaurantId,
    source: "api",
    dimension,
  });
}
