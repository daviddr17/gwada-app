import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PosCapability = {
  key: string;
  labelDe: string;
  descriptionDe: string | null;
  sortOrder: number;
};

export type PosRole = {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  sortOrder: number;
  capabilityKeys: string[];
};

export type PosDevice = {
  id: string;
  name: string;
  kind: "hub" | "handheld";
  enrollmentCodeHint: string | null;
  enrollmentExpiresAt: string | null;
  enrolledAt: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  isEnrolled: boolean;
};

function hashEnrollmentCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function generateEnrollmentCode(): string {
  // 8 chars, unambiguous alphabet
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function generateDeviceToken(): string {
  return randomBytes(32).toString("base64url");
}

export type PosEnrollmentClaim = {
  deviceId: string;
  deviceToken: string;
  restaurantId: string;
  restaurantName: string;
  kind: "hub" | "handheld";
  brandAccentHex: string | null;
};

export async function listPosCapabilities(
  supabase: SupabaseClient,
): Promise<PosCapability[]> {
  const { data, error } = await supabase
    .from("pos_capabilities")
    .select("key, label_de, description_de, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => ({
    key: row.key as string,
    labelDe: row.label_de as string,
    descriptionDe: (row.description_de as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
  }));
}

export async function ensurePosSystemRoles(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  await supabase.rpc("ensure_pos_system_roles", {
    p_restaurant_id: restaurantId,
  });
}

export async function listPosRoles(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosRole[]> {
  await ensurePosSystemRoles(supabase, restaurantId);

  const { data: roles, error } = await supabase
    .from("pos_roles")
    .select("id, name, slug, is_system, sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });
  if (error || !roles) return [];

  const ids = roles.map((r) => r.id as string);
  const { data: caps } = await supabase
    .from("pos_role_capabilities")
    .select("role_id, capability_key")
    .in("role_id", ids);

  const byRole = new Map<string, string[]>();
  for (const row of caps ?? []) {
    const rid = row.role_id as string;
    const list = byRole.get(rid) ?? [];
    list.push(row.capability_key as string);
    byRole.set(rid, list);
  }

  return roles.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    isSystem: Boolean(r.is_system),
    sortOrder: Number(r.sort_order ?? 0),
    capabilityKeys: byRole.get(r.id as string) ?? [],
  }));
}

export async function setPosRoleCapabilities(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  roleId: string;
  capabilityKeys: string[];
}): Promise<boolean> {
  const { supabase, restaurantId, roleId, capabilityKeys } = params;
  const { data: role } = await supabase
    .from("pos_roles")
    .select("id")
    .eq("id", roleId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!role) return false;

  const { error: delErr } = await supabase
    .from("pos_role_capabilities")
    .delete()
    .eq("role_id", roleId);
  if (delErr) return false;

  const unique = [...new Set(capabilityKeys.filter(Boolean))];
  if (unique.length === 0) return true;

  const { error: insErr } = await supabase.from("pos_role_capabilities").insert(
    unique.map((capability_key) => ({ role_id: roleId, capability_key })),
  );
  return !insErr;
}

export async function listPosDevices(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<PosDevice[]> {
  const { data, error } = await supabase
    .from("pos_devices")
    .select(
      "id, name, kind, enrollment_code_hint, enrollment_expires_at, enrolled_at, last_seen_at, is_active, device_token_hash",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as "hub" | "handheld",
    enrollmentCodeHint: (row.enrollment_code_hint as string | null) ?? null,
    enrollmentExpiresAt: (row.enrollment_expires_at as string | null) ?? null,
    enrolledAt: (row.enrolled_at as string | null) ?? null,
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
    isActive: Boolean(row.is_active),
    isEnrolled: Boolean(row.device_token_hash),
  }));
}

export async function createPosDeviceEnrollment(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  name: string;
  kind: "hub" | "handheld";
  ttlHours?: number;
}): Promise<{ device: PosDevice; enrollmentCode: string } | null> {
  const code = generateEnrollmentCode();
  const ttl = Math.min(168, Math.max(1, params.ttlHours ?? 24));
  const expires = new Date(Date.now() + ttl * 3600_000).toISOString();
  const hint = `${code.slice(0, 2)}····${code.slice(-2)}`;

  const { data, error } = await params.supabase
    .from("pos_devices")
    .insert({
      restaurant_id: params.restaurantId,
      name: params.name.trim(),
      kind: params.kind,
      enrollment_code_hash: hashEnrollmentCode(code),
      enrollment_code_hint: hint,
      enrollment_expires_at: expires,
      is_active: true,
    })
    .select(
      "id, name, kind, enrollment_code_hint, enrollment_expires_at, enrolled_at, last_seen_at, is_active, device_token_hash",
    )
    .single();

  if (error || !data) return null;

  return {
    enrollmentCode: code,
    device: {
      id: data.id as string,
      name: data.name as string,
      kind: data.kind as "hub" | "handheld",
      enrollmentCodeHint: (data.enrollment_code_hint as string | null) ?? null,
      enrollmentExpiresAt: (data.enrollment_expires_at as string | null) ?? null,
      enrolledAt: (data.enrolled_at as string | null) ?? null,
      lastSeenAt: (data.last_seen_at as string | null) ?? null,
      isActive: Boolean(data.is_active),
      isEnrolled: Boolean(data.device_token_hash),
    },
  };
}

export async function deactivatePosDevice(
  supabase: SupabaseClient,
  restaurantId: string,
  deviceId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("pos_devices")
    .update({
      is_active: false,
      device_token_hash: null,
      enrollment_code_hash: null,
    })
    .eq("id", deviceId)
    .eq("restaurant_id", restaurantId);
  return !error;
}

/**
 * Löst einen Einrichtungs-Code ein (ohne User-Session — Service-Role).
 * Code ist einmalig; setzt device_token_hash und leert enrollment_*.
 */
export async function claimPosDeviceEnrollment(params: {
  admin: SupabaseClient;
  code: string;
  installationId: string;
  preferredName?: string | null;
}): Promise<
  | { ok: true; claim: PosEnrollmentClaim }
  | { ok: false; error: string; status: number }
> {
  const code = params.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    return { ok: false, error: "invalid_code", status: 400 };
  }
  const installationId = params.installationId.trim();
  if (installationId.length < 8) {
    return { ok: false, error: "invalid_installation_id", status: 400 };
  }

  const codeHash = hashEnrollmentCode(code);
  const { data: device, error } = await params.admin
    .from("pos_devices")
    .select(
      "id, restaurant_id, name, kind, enrollment_expires_at, device_token_hash, is_active",
    )
    .eq("enrollment_code_hash", codeHash)
    .maybeSingle();

  if (error || !device) {
    return { ok: false, error: "code_not_found", status: 404 };
  }
  if (!device.is_active) {
    return { ok: false, error: "device_inactive", status: 403 };
  }
  if (device.device_token_hash) {
    return { ok: false, error: "already_enrolled", status: 409 };
  }
  const expiresAt = device.enrollment_expires_at as string | null;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    await params.admin
      .from("pos_devices")
      .update({
        enrollment_code_hash: null,
        enrollment_code_hint: null,
        enrollment_expires_at: null,
      })
      .eq("id", device.id);
    return { ok: false, error: "code_expired", status: 410 };
  }

  const { data: restaurant } = await params.admin
    .from("restaurants")
    .select("id, name, brand_accent_hex")
    .eq("id", device.restaurant_id)
    .maybeSingle();
  if (!restaurant) {
    return { ok: false, error: "restaurant_not_found", status: 404 };
  }

  const deviceToken = generateDeviceToken();
  const name =
    params.preferredName?.trim() ||
    (device.name as string) ||
    (device.kind === "hub" ? "Kasse" : "Handgerät");

  const { error: updErr } = await params.admin
    .from("pos_devices")
    .update({
      name,
      device_token_hash: hashDeviceToken(deviceToken),
      enrolled_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      enrollment_code_hash: null,
      enrollment_code_hint: null,
      enrollment_expires_at: null,
      // installation id stored only client-side for now; token binds device
    })
    .eq("id", device.id)
    .is("device_token_hash", null);

  if (updErr) {
    return { ok: false, error: "claim_failed", status: 500 };
  }

  return {
    ok: true,
    claim: {
      deviceId: device.id as string,
      deviceToken,
      restaurantId: restaurant.id as string,
      restaurantName: (restaurant.name as string) || "Restaurant",
      kind: device.kind as "hub" | "handheld",
      brandAccentHex: (restaurant.brand_accent_hex as string | null) ?? null,
    },
  };
}

export async function verifyPosDeviceToken(params: {
  admin: SupabaseClient;
  deviceId: string;
  deviceToken: string;
  restaurantId?: string | null;
}): Promise<
  | {
      ok: true;
      deviceId: string;
      restaurantId: string;
      kind: "hub" | "handheld";
    }
  | { ok: false; error: string; status: number }
> {
  const deviceId = params.deviceId.trim();
  const token = params.deviceToken.trim();
  if (!deviceId || !token) {
    return { ok: false, error: "unauthorized", status: 401 };
  }
  const tokenHash = hashDeviceToken(token);
  const { data: device, error } = await params.admin
    .from("pos_devices")
    .select("id, restaurant_id, kind, is_active, device_token_hash")
    .eq("id", deviceId)
    .eq("device_token_hash", tokenHash)
    .maybeSingle();

  if (error || !device || !device.is_active) {
    return { ok: false, error: "unauthorized", status: 401 };
  }
  const restaurantId = device.restaurant_id as string;
  if (
    params.restaurantId &&
    params.restaurantId.trim() &&
    params.restaurantId.trim() !== restaurantId
  ) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  await params.admin
    .from("pos_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", deviceId);

  return {
    ok: true,
    deviceId,
    restaurantId,
    kind: device.kind as "hub" | "handheld",
  };
}

export { hashEnrollmentCode, hashDeviceToken };
