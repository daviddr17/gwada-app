import "server-only";

import {
  generateDisplayToken,
  generatePairingCode,
  hashDisplayToken,
} from "@/lib/display/display-crypto";
import {
  parsePosDeviceHeader,
  parsePosSessionHeader,
  POS_DEVICE_HEADER,
  POS_SESSION_HEADER,
} from "@/lib/pos/pos-device-headers";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { generateDisplayToken as generatePosToken, generatePairingCode, hashDisplayToken as hashPosToken };

export type PosDeviceRow = {
  id: string;
  restaurant_id: string;
  name: string;
  auto_lock_seconds: number;
  is_active: boolean;
};

export type PosSessionRow = {
  id: string;
  device_id: string;
  staff_id: string;
  restaurant_id: string;
  session_token_hash: string;
  last_activity_at: string;
  ended_at: string | null;
};

export type PosSessionStaff = {
  id: string;
  given_name: string;
  family_name: string;
  profile_id: string | null;
  position_name: string | null;
};

export async function loadPosDevice(
  deviceId: string,
): Promise<PosDeviceRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_pos_devices")
    .select("id, restaurant_id, name, auto_lock_seconds, is_active")
    .eq("id", deviceId)
    .maybeSingle();
  return (data as PosDeviceRow | null) ?? null;
}

async function findPosDeviceIdForToken(
  deviceId: string,
  token: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const hash = hashDisplayToken(token);
  const { data } = await admin
    .from("restaurant_pos_installations")
    .select("id")
    .eq("device_id", deviceId)
    .eq("device_secret_hash", hash)
    .maybeSingle();
  return Boolean(data);
}

export async function assertPosDeviceFromRequest(
  request: Request,
): Promise<
  | { ok: true; device: PosDeviceRow; deviceToken: string }
  | { ok: false; error: string; status: number }
> {
  const parsed = parsePosDeviceHeader(request.headers.get(POS_DEVICE_HEADER));
  if (!parsed) {
    return { ok: false, error: "device_not_paired", status: 401 };
  }

  const device = await loadPosDevice(parsed.deviceId);
  if (!device || !device.is_active) {
    return { ok: false, error: "device_not_paired", status: 401 };
  }

  const valid = await findPosDeviceIdForToken(parsed.deviceId, parsed.token);
  if (!valid) {
    return { ok: false, error: "device_invalid", status: 403 };
  }

  return { ok: true, device, deviceToken: parsed.token };
}

export async function loadOpenPosSession(
  sessionId: string,
): Promise<PosSessionRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_pos_sessions")
    .select(
      "id, device_id, staff_id, restaurant_id, session_token_hash, last_activity_at, ended_at",
    )
    .eq("id", sessionId)
    .is("ended_at", null)
    .maybeSingle();
  return (data as PosSessionRow | null) ?? null;
}

export async function endPosSession(sessionId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("restaurant_pos_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null);
}

export async function touchPosSession(sessionId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { error } = await admin
    .from("restaurant_pos_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("ended_at", null);
  return !error;
}

export async function staffPosPermissionKeys(
  staffId: string,
): Promise<Set<string>> {
  const admin = createSupabaseAdminClient();
  if (!admin) return new Set();
  const { data } = await admin.rpc("staff_display_permission_keys", {
    p_staff_id: staffId,
  });
  return new Set<string>((data as string[] | null) ?? []);
}

/** PIN-Login / Bedienen: use oder manage. */
export function staffCanUsePos(keys: Set<string>): boolean {
  return keys.has("pos.kasse.use") || keys.has("pos.kasse.manage");
}

export async function loadPosSessionStaff(
  staffId: string,
): Promise<PosSessionStaff | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_staff")
    .select(
      `
      id,
      given_name,
      family_name,
      profile_id,
      restaurant_position:restaurant_positions ( name )
    `,
    )
    .eq("id", staffId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  const position = data.restaurant_position as
    | { name?: string }
    | { name?: string }[]
    | null;
  const positionName = Array.isArray(position)
    ? (position[0]?.name ?? null)
    : (position?.name ?? null);

  return {
    id: data.id as string,
    given_name: (data.given_name as string) ?? "",
    family_name: (data.family_name as string) ?? "",
    profile_id: (data.profile_id as string | null) ?? null,
    position_name: positionName,
  };
}

export async function assertPosPinSessionFromRequest(
  request: Request,
  device: PosDeviceRow,
): Promise<
  | {
      ok: true;
      session: PosSessionRow;
      staff: PosSessionStaff;
      permissionKeys: Set<string>;
    }
  | { ok: false; error: string; status: number }
> {
  const parsed = parsePosSessionHeader(request.headers.get(POS_SESSION_HEADER));
  if (!parsed) {
    return { ok: false, error: "session_locked", status: 401 };
  }

  const session = await loadOpenPosSession(parsed.sessionId);
  if (!session || session.device_id !== device.id) {
    return { ok: false, error: "session_locked", status: 401 };
  }

  if (hashDisplayToken(parsed.token) !== session.session_token_hash) {
    return { ok: false, error: "session_invalid", status: 403 };
  }

  const idleMs = Date.now() - new Date(session.last_activity_at).getTime();
  if (idleMs > device.auto_lock_seconds * 1000) {
    await endPosSession(session.id);
    return { ok: false, error: "session_expired", status: 401 };
  }

  const [staff, permissionKeys] = await Promise.all([
    loadPosSessionStaff(session.staff_id),
    staffPosPermissionKeys(session.staff_id),
  ]);

  if (!staff) {
    await endPosSession(session.id);
    return { ok: false, error: "session_locked", status: 401 };
  }

  if (!staffCanUsePos(permissionKeys)) {
    await endPosSession(session.id);
    return { ok: false, error: "forbidden_pos", status: 403 };
  }

  return { ok: true, session, staff, permissionKeys };
}

export async function upsertPosInstallation(params: {
  deviceId: string;
  installationId: string;
  deviceToken: string;
  userAgent: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const hash = hashDisplayToken(params.deviceToken);
  const { error } = await admin.from("restaurant_pos_installations").upsert(
    {
      device_id: params.deviceId,
      installation_id: params.installationId,
      device_secret_hash: hash,
      user_agent: params.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "device_id,installation_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function restorePosInstallation(params: {
  deviceId: string;
  installationId: string;
  deviceToken: string;
}): Promise<
  | { ok: true; device: PosDeviceRow }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const hash = hashDisplayToken(params.deviceToken);
  const { data: inst } = await admin
    .from("restaurant_pos_installations")
    .select("id")
    .eq("device_id", params.deviceId)
    .eq("installation_id", params.installationId)
    .eq("device_secret_hash", hash)
    .maybeSingle();

  if (!inst) {
    return { ok: false, error: "device_invalid", status: 403 };
  }

  await admin
    .from("restaurant_pos_installations")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", inst.id);

  const device = await loadPosDevice(params.deviceId);
  if (!device || !device.is_active) {
    return { ok: false, error: "device_not_paired", status: 401 };
  }

  return { ok: true, device };
}

export function staffHasPosPermission(
  keys: Set<string>,
  permissionKey: RestaurantPermissionKey,
): boolean {
  return keys.has(permissionKey);
}
