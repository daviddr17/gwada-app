import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ALL_RESTAURANT_PERMISSION_KEYS,
  type RestaurantPermissionKey,
} from "@/lib/permissions/restaurant-permissions";
import {
  assertPosDeviceFromRequest,
  assertPosPinSessionFromRequest,
  staffHasPosPermission,
  touchPosSession,
} from "@/lib/pos/pos-device-auth-server";
import { POS_DEVICE_HEADER } from "@/lib/pos/pos-device-headers";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { getSupabaseAnonKey } from "@/lib/public-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";

export type PosRouteAuth = {
  restaurantId: string;
  /**
   * auth.users / profile id when available.
   * PIN-Login ohne verknüpftes Login-Konto: `null` (FK-Felder setzen null).
   */
  userId: string | null;
  staffId?: string | null;
  supabase: SupabaseClient;
  authMode: "user" | "pin_session";
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

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, userId: user.id };
}

async function authorizeFromPinSession(
  request: Request,
  restaurantId: string,
): Promise<
  | { ok: true; auth: PosRouteAuth; permissionKeys: Set<string> }
  | { ok: false; status: number; error: string }
> {
  const deviceResult = await assertPosDeviceFromRequest(request);
  if (!deviceResult.ok) {
    return {
      ok: false,
      status: deviceResult.status,
      error: deviceResult.error,
    };
  }

  if (deviceResult.device.restaurant_id !== restaurantId) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const sessionResult = await assertPosPinSessionFromRequest(
    request,
    deviceResult.device,
  );
  if (!sessionResult.ok) {
    return {
      ok: false,
      status: sessionResult.status,
      error: sessionResult.error,
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, status: 503, error: "server_misconfigured" };
  }

  void touchPosSession(sessionResult.session.id);

  return {
    ok: true,
    auth: {
      restaurantId,
      userId: sessionResult.staff.profile_id,
      staffId: sessionResult.staff.id,
      supabase: admin,
      authMode: "pin_session",
    },
    permissionKeys: sessionResult.permissionKeys,
  };
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

  if (request.headers.get(POS_DEVICE_HEADER)) {
    const pinAuth = await authorizeFromPinSession(request, restaurantId);
    if (pinAuth.ok) return { ok: true, auth: pinAuth.auth };
    // Device header present but session missing/invalid → do not fall through to cookies.
    if (!bearerToken(request)) {
      return {
        ok: false,
        status: pinAuth.status,
        error: pinAuth.error,
      };
    }
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
      authMode: "user",
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
  const restaurantId = restaurantIdRaw?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_restaurant_id" };
  }

  if (request.headers.get(POS_DEVICE_HEADER)) {
    const pinAuth = await authorizeFromPinSession(request, restaurantId);
    if (!pinAuth.ok) {
      if (!bearerToken(request)) {
        return {
          ok: false,
          status: pinAuth.status,
          error: pinAuth.error,
        };
      }
    } else {
      if (!staffHasPosPermission(pinAuth.permissionKeys, permissionKey)) {
        return { ok: false, status: 403, error: "forbidden" };
      }
      return { ok: true, auth: pinAuth.auth };
    }
  }

  const base = await authorizePosRestaurant(request, restaurantIdRaw);
  if (!base.ok) return base;
  if (!base.auth.userId) {
    return { ok: false, status: 403, error: "forbidden" };
  }

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
