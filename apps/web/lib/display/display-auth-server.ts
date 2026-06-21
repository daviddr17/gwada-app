import "server-only";

import type { cookies } from "next/headers";
import {
  generateDisplayToken,
  generatePairingCode,
  hashDisplayToken,
} from "@/lib/display/display-crypto";
import {
  displayHasInstallations,
  findDisplayIdForDeviceToken,
} from "@/lib/display/display-installation-server";
import { resolveStaffDisplayModules } from "@/lib/display/display-modules";
import {
  DISPLAY_DEVICE_COOKIE,
  DISPLAY_SESSION_COOKIE,
  parseDisplayDeviceCookie,
  parseDisplaySessionCookie,
} from "@/lib/display/display-cookies";
import type {
  DisplayContextResponse,
  DisplayModule,
  DisplayPairingStatus,
  DisplaySessionStaff,
} from "@/lib/display/display-types";
import {
  signRestaurantAvatarUrl,
  signStaffAvatarUrl,
} from "@/lib/display/display-storage-urls";
import { getStaffDisplayTimeState } from "@/lib/staff/staff-display-time-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeHex } from "@/lib/theme/color-utils";

export { generateDisplayToken, generatePairingCode, hashDisplayToken } from "@/lib/display/display-crypto";

type DisplayDeviceRow = {
  id: string;
  restaurant_id: string;
  name: string;
  allowed_modules: DisplayModule[];
  auto_lock_seconds: number;
  device_secret_hash: string | null;
  is_active: boolean;
};

type DisplaySessionRow = {
  id: string;
  display_id: string;
  staff_id: string;
  restaurant_id: string;
  session_token_hash: string;
  last_activity_at: string;
  ended_at: string | null;
};

export async function loadDisplayDevice(
  displayId: string,
): Promise<DisplayDeviceRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_displays")
    .select(
      "id, restaurant_id, name, allowed_modules, auto_lock_seconds, device_secret_hash, is_active",
    )
    .eq("id", displayId)
    .maybeSingle();
  return (data as DisplayDeviceRow | null) ?? null;
}

export async function assertDisplayDeviceFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<
  | { ok: true; display: DisplayDeviceRow; deviceToken: string }
  | { ok: false; error: string; status: number }
> {
  const parsed = parseDisplayDeviceCookie(
    cookieStore.get(DISPLAY_DEVICE_COOKIE)?.value,
  );
  if (!parsed) {
    return { ok: false, error: "device_not_paired", status: 401 };
  }

  const display = await loadDisplayDevice(parsed.displayId);
  if (!display || !display.is_active) {
    return { ok: false, error: "device_not_paired", status: 401 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const valid = await findDisplayIdForDeviceToken(
    admin,
    parsed.displayId,
    parsed.token,
  );
  if (!valid) {
    return { ok: false, error: "device_invalid", status: 403 };
  }

  return { ok: true, display, deviceToken: parsed.token };
}

export async function loadOpenDisplaySession(
  sessionId: string,
): Promise<DisplaySessionRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_display_sessions")
    .select(
      "id, display_id, staff_id, restaurant_id, session_token_hash, last_activity_at, ended_at",
    )
    .eq("id", sessionId)
    .is("ended_at", null)
    .maybeSingle();
  return (data as DisplaySessionRow | null) ?? null;
}

export async function assertDisplaySessionFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  display: DisplayDeviceRow,
): Promise<
  | {
      ok: true;
      session: DisplaySessionRow;
      staff: DisplaySessionStaff;
      modules: DisplayModule[];
      canSwitchModules: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  const parsed = parseDisplaySessionCookie(
    cookieStore.get(DISPLAY_SESSION_COOKIE)?.value,
  );
  if (!parsed) {
    return { ok: false, error: "session_locked", status: 401 };
  }

  const session = await loadOpenDisplaySession(parsed.sessionId);
  if (!session || session.display_id !== display.id) {
    return { ok: false, error: "session_locked", status: 401 };
  }

  const hash = hashDisplayToken(parsed.token);
  if (hash !== session.session_token_hash) {
    return { ok: false, error: "session_invalid", status: 403 };
  }

  const idleMs =
    Date.now() - new Date(session.last_activity_at).getTime();
  if (idleMs > display.auto_lock_seconds * 1000) {
    await endDisplaySession(session.id);
    return { ok: false, error: "session_expired", status: 401 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { data: staffRow } = await admin
    .from("restaurant_staff")
    .select(
      `
      id,
      given_name,
      family_name,
      avatar_storage_path,
      restaurant_position:restaurant_positions ( name )
    `,
    )
    .eq("id", session.staff_id)
    .maybeSingle();

  if (!staffRow) {
    return { ok: false, error: "staff_not_found", status: 404 };
  }

  const posRaw = (staffRow as Record<string, unknown>).restaurant_position;
  const posOne = Array.isArray(posRaw) ? posRaw[0] : posRaw;
  const positionName =
    posOne && typeof posOne === "object" && "name" in posOne
      ? String((posOne as { name: string }).name)
      : null;

  const { data: permKeys } = await admin.rpc("staff_display_permission_keys", {
    p_staff_id: session.staff_id,
  });

  const { modules, canSwitchModules } = resolveStaffDisplayModules({
    displayModules: display.allowed_modules ?? [],
    staffPermissionKeys: (permKeys as string[] | null) ?? [],
  });

  const staff: DisplaySessionStaff = {
    id: staffRow.id as string,
    given_name: staffRow.given_name as string,
    family_name: staffRow.family_name as string,
    avatar_url: await signStaffAvatarUrl(
      admin,
      staffRow.avatar_storage_path as string | null,
    ),
    position_name: positionName,
  };

  return {
    ok: true,
    session,
    staff,
    modules,
    canSwitchModules,
  };
}

export async function endDisplaySession(sessionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("restaurant_display_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null);
}

export async function touchDisplaySession(sessionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("restaurant_display_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null);
}

export async function resolveDisplayPairingStatus(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<
  | {
      status: "ok";
      display: DisplayDeviceRow;
      deviceToken: string;
    }
  | { status: DisplayPairingStatus }
> {
  const parsed = parseDisplayDeviceCookie(
    cookieStore.get(DISPLAY_DEVICE_COOKIE)?.value,
  );
  if (!parsed) {
    return { status: "no_device_cookie" };
  }

  const display = await loadDisplayDevice(parsed.displayId);
  if (!display) {
    return { status: "display_missing" };
  }
  if (!display.is_active) {
    return { status: "display_inactive" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { status: "not_paired_server" };
  }

  const hasInstallations = await displayHasInstallations(display.id);
  if (!display.device_secret_hash && !hasInstallations) {
    return { status: "not_paired_server" };
  }

  const valid = await findDisplayIdForDeviceToken(
    admin,
    display.id,
    parsed.token,
  );
  if (!valid) {
    return { status: "token_revoked" };
  }

  return { status: "ok", display, deviceToken: parsed.token };
}

export async function buildDisplayContext(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<DisplayContextResponse> {
  const pairing = await resolveDisplayPairingStatus(cookieStore);
  if (pairing.status !== "ok") {
    return {
      paired: false,
      pairing_status: pairing.status,
      restaurant: null,
      display: null,
      session: null,
      time_session: null,
    };
  }

  const deviceResult = {
    ok: true as const,
    display: pairing.display,
    deviceToken: pairing.deviceToken,
  };

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      paired: false,
      restaurant: null,
      display: null,
      session: null,
      time_session: null,
    };
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name, slug, brand_accent_hex, avatar_storage_path, cover_storage_path")
    .eq("id", deviceResult.display.restaurant_id)
    .maybeSingle();

  const sessionResult = await assertDisplaySessionFromCookies(
    cookieStore,
    deviceResult.display,
  );

  let timeSession: DisplayContextResponse["time_session"] = null;
  if (sessionResult.ok) {
    timeSession = await getStaffDisplayTimeState(
      admin,
      sessionResult.session.staff_id,
    );
  }

  return {
    paired: true,
    restaurant: restaurant
      ? {
          id: restaurant.id as string,
          name: restaurant.name as string,
          slug: restaurant.slug as string,
          accent_hex:
            normalizeHex(String(restaurant.brand_accent_hex ?? "")) ?? null,
          avatar_url: await signRestaurantAvatarUrl(
            admin,
            restaurant.avatar_storage_path as string | null,
          ),
          cover_url: await signRestaurantAvatarUrl(
            admin,
            restaurant.cover_storage_path as string | null,
          ),
        }
      : null,
    display: {
      id: deviceResult.display.id,
      name: deviceResult.display.name,
      allowed_modules: deviceResult.display.allowed_modules ?? [],
      auto_lock_seconds: deviceResult.display.auto_lock_seconds,
    },
    session: sessionResult.ok
      ? {
          id: sessionResult.session.id,
          staff: sessionResult.staff,
          modules: sessionResult.modules,
          can_switch_modules: sessionResult.canSwitchModules,
          last_activity_at: sessionResult.session.last_activity_at,
        }
      : null,
    time_session: timeSession,
  };
}

export async function assertDisplaySessionAccess(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Promise<
  | {
      ok: true;
      display: DisplayDeviceRow;
      session: DisplaySessionRow;
      staffId: string;
      restaurantId: string;
    }
  | { ok: false; error: string; status: number }
> {
  const deviceResult = await assertDisplayDeviceFromCookies(cookieStore);
  if (!deviceResult.ok) return deviceResult;

  const sessionResult = await assertDisplaySessionFromCookies(
    cookieStore,
    deviceResult.display,
  );
  if (!sessionResult.ok) return sessionResult;

  await touchDisplaySession(sessionResult.session.id);

  return {
    ok: true,
    display: deviceResult.display,
    session: sessionResult.session,
    staffId: sessionResult.session.staff_id,
    restaurantId: sessionResult.session.restaurant_id,
  };
}

export async function assertDisplayModuleAccess(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  module: DisplayModule,
): Promise<
  | {
      ok: true;
      display: DisplayDeviceRow;
      session: DisplaySessionRow;
      staffId: string;
      restaurantId: string;
    }
  | { ok: false; error: string; status: number }
> {
  const deviceResult = await assertDisplayDeviceFromCookies(cookieStore);
  if (!deviceResult.ok) return deviceResult;

  const sessionResult = await assertDisplaySessionFromCookies(
    cookieStore,
    deviceResult.display,
  );
  if (!sessionResult.ok) return sessionResult;

  if (!sessionResult.modules.includes(module)) {
    return { ok: false, error: "module_forbidden", status: 403 };
  }

  await touchDisplaySession(sessionResult.session.id);

  return {
    ok: true,
    display: deviceResult.display,
    session: sessionResult.session,
    staffId: sessionResult.session.staff_id,
    restaurantId: sessionResult.session.restaurant_id,
  };
}

export async function staffHasDisplayPermission(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  staffId: string,
  permissionKey: string,
): Promise<boolean> {
  const { data: permKeys } = await admin.rpc("staff_display_permission_keys", {
    p_staff_id: staffId,
  });
  return ((permKeys as string[] | null) ?? []).includes(permissionKey);
}
