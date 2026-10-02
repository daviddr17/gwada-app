import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isLikelyBotUserAgent } from "@/lib/insights/restaurant-usage-server";
import {
  productUsageTarget,
  websiteAnalyticsTarget,
} from "@/lib/analytics/classify-analytics-path";
import {
  ANALYTICS_SESSION_COOKIE,
  ANALYTICS_VISITOR_COOKIE,
  buildPageViewInsert,
  countryCodeFromHeaders,
  externalReferrerHost,
  isAnalyticsUuid,
  parseAnalyticsBrowser,
  parseAnalyticsDevice,
} from "@/lib/analytics/parse-analytics-request";

const LOGIN_METHODS = new Set([
  "password",
  "passkey",
  "oauth",
  "magiclink",
  "otp",
  "invite",
  "recovery",
]);

const LOGIN_DEDUPE_MS = 90_000;
const MODULE_DEDUPE_MS = 15_000;

export function analyticsCollectIsBot(request: Request): boolean {
  return isLikelyBotUserAgent(request.headers.get("user-agent"));
}

export function readOrCreateAnalyticsIds(request: Request): {
  visitorId: string;
  sessionId: string;
  setVisitor: boolean;
  setSession: boolean;
} {
  const visitorCookie = request.headers.get("cookie") ?? "";
  const visitor = readCookie(visitorCookie, ANALYTICS_VISITOR_COOKIE);
  const session = readCookie(visitorCookie, ANALYTICS_SESSION_COOKIE);
  const visitorId = isAnalyticsUuid(visitor) ? visitor : crypto.randomUUID();
  const sessionId = isAnalyticsUuid(session) ? session : crypto.randomUUID();
  return {
    visitorId,
    sessionId,
    setVisitor: visitorId !== visitor,
    setSession: true,
  };
}

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function applyAnalyticsCookies(
  response: NextResponse,
  ids: { visitorId: string; sessionId: string },
): void {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set({
    name: ANALYTICS_VISITOR_COOKIE,
    value: ids.visitorId,
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
  response.cookies.set({
    name: ANALYTICS_SESSION_COOKIE,
    value: ids.sessionId,
    path: "/",
    maxAge: 60 * 30,
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
}

export async function recordWebsitePageView(params: {
  admin: SupabaseClient;
  request: Request;
  path: string;
  referrer: string | null;
}): Promise<{ visitorId: string; sessionId: string } | null> {
  const target = websiteAnalyticsTarget(params.path);
  if (!target) return null;
  const ids = readOrCreateAnalyticsIds(params.request);
  const host = requestHost(params.request);
  const row = buildPageViewInsert({
    path: target.path,
    surface: target.surface,
    referrer_host: externalReferrerHost(params.referrer, host),
    device: parseAnalyticsDevice(params.request.headers.get("user-agent")),
    browser: parseAnalyticsBrowser(params.request.headers.get("user-agent")),
    country_code: countryCodeFromHeaders(params.request.headers),
    visitor_id: ids.visitorId,
    session_id: ids.sessionId,
  });
  const { error } = await params.admin.from("platform_page_views").insert(row);
  if (error) {
    console.warn("[gwada] platform_page_views", error.message);
  }
  return { visitorId: ids.visitorId, sessionId: ids.sessionId };
}

export async function recordPlatformLogin(params: {
  admin: SupabaseClient;
  profileId: string;
  method: string;
}): Promise<void> {
  if (!isAnalyticsUuid(params.profileId)) return;
  const method = LOGIN_METHODS.has(params.method) ? params.method : "unknown";
  const since = new Date(Date.now() - LOGIN_DEDUPE_MS).toISOString();
  const { data: existing, error: existingError } = await params.admin
    .from("platform_usage_events")
    .select("id")
    .eq("kind", "login")
    .eq("profile_id", params.profileId)
    .gte("occurred_at", since)
    .limit(1);
  if (existingError) {
    console.warn("[gwada] platform_usage_events login lookup", existingError.message);
    return;
  }
  if (existing && existing.length > 0) return;

  const { error } = await params.admin.from("platform_usage_events").insert({
    kind: "login",
    profile_id: params.profileId,
    login_method: method,
  });
  if (error) {
    console.warn("[gwada] platform_usage_events login", error.message);
  }
}

export async function recordModuleView(params: {
  admin: SupabaseClient;
  profileId: string;
  path: string;
  restaurantId: string | null;
}): Promise<void> {
  const target = productUsageTarget(params.path);
  if (!target || !isAnalyticsUuid(params.profileId)) return;
  const restaurantId =
    params.restaurantId && isAnalyticsUuid(params.restaurantId)
      ? params.restaurantId
      : null;
  const since = new Date(Date.now() - MODULE_DEDUPE_MS).toISOString();
  let lookup = params.admin
    .from("platform_usage_events")
    .select("id")
    .eq("kind", "module_view")
    .eq("profile_id", params.profileId)
    .eq("path", target.path)
    .gte("occurred_at", since)
    .limit(1);
  lookup = restaurantId ? lookup.eq("restaurant_id", restaurantId) : lookup.is("restaurant_id", null);
  const { data: existing, error: existingError } = await lookup;
  if (existingError) {
    console.warn("[gwada] platform_usage_events module lookup", existingError.message);
    return;
  }
  if (existing && existing.length > 0) return;

  const { error } = await params.admin.from("platform_usage_events").insert({
    kind: "module_view",
    profile_id: params.profileId,
    restaurant_id: restaurantId,
    module_id: target.moduleId,
    path: target.path,
  });
  if (error) {
    console.warn("[gwada] platform_usage_events module", error.message);
  }
}

export async function resolveUsageRestaurantId(
  admin: SupabaseClient,
  profileId: string,
  rawRestaurantId: string | null,
): Promise<string | null> {
  if (!isAnalyticsUuid(rawRestaurantId)) return null;
  const { data: member } = await admin
    .from("restaurant_employees")
    .select("id")
    .eq("restaurant_id", rawRestaurantId)
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();
  if (member) return rawRestaurantId;

  const { data: superadmin } = await admin
    .from("platform_superadmins")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!superadmin) return null;

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id")
    .eq("id", rawRestaurantId)
    .maybeSingle();
  return restaurant ? rawRestaurantId : null;
}

function requestHost(request: Request): string | null {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
}
