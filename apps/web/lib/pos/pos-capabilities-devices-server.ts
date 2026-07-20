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

export { hashEnrollmentCode };
