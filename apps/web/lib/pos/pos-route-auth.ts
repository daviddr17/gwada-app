import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ALL_RESTAURANT_PERMISSION_KEYS,
  type RestaurantPermissionKey,
} from "@/lib/permissions/restaurant-permissions";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";

export type PosRouteAuth = {
  restaurantId: string;
  userId: string;
  supabase: SupabaseClient;
};

function bearerToken(request: Request): string | null {
  const match = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function resolvePosSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") ||
    resolveSupabaseUpstreamUrl()
  );
}

function resolvePosApiKey(): string | null {
  return (
    getSupabaseAnonKey()?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

function resolvePosAnonKey(): string | null {
  return getSupabaseAnonKey()?.trim() ?? null;
}

function userScopedSupabase(accessToken: string): SupabaseClient | null {
  const anonKey = resolvePosAnonKey();
  if (!anonKey) return null;

  return createClient(resolvePosSupabaseUrl(), anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Validates mobile Bearer JWT via GoTrue (robust with publishable + ES256 tokens). */
async function fetchUserIdFromAccessToken(
  accessToken: string,
): Promise<string | null> {
  const url = resolvePosSupabaseUrl();
  const apikey = resolvePosApiKey();
  if (!url || !apikey) return null;

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[pos] auth/v1/user", res.status, res.statusText);
      }
      return null;
    }

    const body = (await res.json()) as { id?: string };
    return body.id?.trim() ?? null;
  } catch (err) {
    console.warn("[pos] auth/v1/user fetch failed", err);
    return null;
  }
}

async function authFromBearerToken(
  accessToken: string,
): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  let userId = await fetchUserIdFromAccessToken(accessToken);

  if (!userId) {
    const admin = createSupabaseAdminClient();
    if (admin) {
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(accessToken);
      if (!error && user) userId = user.id;
      else if (error && process.env.NODE_ENV === "development") {
        console.warn("[pos] admin getUser", error.message);
      }
    }
  }

  if (!userId) return null;

  const scoped = userScopedSupabase(accessToken);
  if (scoped) {
    return { supabase: scoped, userId };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  return { supabase: admin, userId };
}

async function isActiveRestaurantStaff(
  supabase: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<boolean> {
  const { data: isStaff, error: staffError } = await supabase.rpc(
    "auth_is_restaurant_staff",
    { p_restaurant_id: restaurantId },
  );

  if (!staffError) return Boolean(isStaff);

  if (process.env.NODE_ENV === "development") {
    console.warn("[pos] auth_is_restaurant_staff", staffError.message);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const { data: row } = await admin
    .from("restaurant_employees")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  return Boolean(row);
}

async function userRestaurantPermissionKeys(
  supabase: SupabaseClient,
  restaurantId: string,
  userId: string,
): Promise<Set<string>> {
  const { data: keys, error } = await supabase.rpc(
    "auth_user_restaurant_permission_keys",
    { p_restaurant_id: restaurantId },
  );

  const result = new Set<string>((keys as string[] | null) ?? []);

  if (!error && result.size > 0) {
    return result;
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return result;

  const { data: employee } = await admin
    .from("restaurant_employees")
    .select("role, restaurant_positions(slug)")
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const positionSlug = (
    employee as { restaurant_positions?: { slug?: string } | null } | null
  )?.restaurant_positions?.slug;
  const employeeRole = (employee as { role?: string } | null)?.role;

  if (positionSlug === "owner" || employeeRole === "owner") {
    for (const key of ALL_RESTAURANT_PERMISSION_KEYS) {
      result.add(key);
    }
  }

  return result;
}

async function supabaseFromRequest(
  request: Request,
): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const token = bearerToken(request);
  if (token) {
    return authFromBearerToken(token);
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[pos] missing Authorization bearer");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, userId: user.id };
}

export async function authorizePosRestaurant(
  request: Request,
  restaurantIdRaw: string | null,
): Promise<
  | { ok: true; auth: PosRouteAuth }
  | { ok: false; status: number; error: string }
> {
  const restaurantId = restaurantIdRaw?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_restaurant_id" };
  }

  const session = await supabaseFromRequest(request);
  if (!session) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const isStaff = await isActiveRestaurantStaff(
    session.supabase,
    restaurantId,
    session.userId,
  );

  if (!isStaff) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return {
    ok: true,
    auth: {
      restaurantId,
      userId: session.userId,
      supabase: session.supabase,
    },
  };
}

export async function authorizePosRestaurantPermission(
  request: Request,
  restaurantIdRaw: string | null,
  permissionKey: RestaurantPermissionKey,
): Promise<
  | { ok: true; auth: PosRouteAuth }
  | { ok: false; status: number; error: string }
> {
  const base = await authorizePosRestaurant(request, restaurantIdRaw);
  if (!base.ok) return base;

  const keys = await userRestaurantPermissionKeys(
    base.auth.supabase,
    base.auth.restaurantId,
    base.auth.userId,
  );

  if (!keys.has(permissionKey)) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  return base;
}
