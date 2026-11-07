import "server-only";

import {
  generateDisplayToken,
  generatePairingCode,
  hashDisplayToken,
} from "@/lib/display/display-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export {
  generateDisplayToken as generateGuestKioskToken,
  generatePairingCode as generateGuestKioskPairingCode,
  hashDisplayToken as hashGuestKioskToken,
};

export const GUEST_KIOSK_DEVICE_HEADER = "x-gwada-kiosk-device";

export type GuestKioskDeviceRow = {
  id: string;
  restaurant_id: string;
  name: string;
  mollie_terminal_id: string | null;
  is_active: boolean;
};

export function formatGuestKioskDeviceHeader(
  deviceId: string,
  token: string,
): string {
  return `${deviceId}.${token}`;
}

export function parseGuestKioskDeviceHeader(
  raw: string | null,
): { deviceId: string; token: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const dot = trimmed.indexOf(".");
  if (dot <= 0 || dot === trimmed.length - 1) return null;
  const deviceId = trimmed.slice(0, dot).trim();
  const token = trimmed.slice(dot + 1).trim();
  if (!deviceId || !token) return null;
  return { deviceId, token };
}

export async function loadGuestKioskDevice(
  deviceId: string,
): Promise<GuestKioskDeviceRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("restaurant_guest_kiosk_devices")
    .select("id, restaurant_id, name, mollie_terminal_id, is_active")
    .eq("id", deviceId)
    .maybeSingle();
  return (data as GuestKioskDeviceRow | null) ?? null;
}

async function findGuestKioskDeviceTokenValid(
  deviceId: string,
  token: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const hash = hashDisplayToken(token);
  const { data } = await admin
    .from("restaurant_guest_kiosk_installations")
    .select("id")
    .eq("device_id", deviceId)
    .eq("device_secret_hash", hash)
    .maybeSingle();
  return Boolean(data);
}

export async function assertGuestKioskDeviceFromRequest(
  request: Request,
): Promise<
  | { ok: true; device: GuestKioskDeviceRow; deviceToken: string }
  | { ok: false; error: string; status: number }
> {
  const parsed = parseGuestKioskDeviceHeader(
    request.headers.get(GUEST_KIOSK_DEVICE_HEADER),
  );
  if (!parsed) {
    return { ok: false, error: "device_not_paired", status: 401 };
  }

  const device = await loadGuestKioskDevice(parsed.deviceId);
  if (!device || !device.is_active) {
    return { ok: false, error: "device_not_paired", status: 401 };
  }

  const valid = await findGuestKioskDeviceTokenValid(
    parsed.deviceId,
    parsed.token,
  );
  if (!valid) {
    return { ok: false, error: "device_invalid", status: 403 };
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    await admin
      .from("restaurant_guest_kiosk_installations")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("device_id", device.id)
      .eq("device_secret_hash", hashDisplayToken(parsed.token));
  }

  return { ok: true, device, deviceToken: parsed.token };
}

export async function upsertGuestKioskInstallation(params: {
  deviceId: string;
  installationId: string;
  deviceToken: string;
  userAgent: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const hash = hashDisplayToken(params.deviceToken);
  const { error } = await admin
    .from("restaurant_guest_kiosk_installations")
    .upsert(
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

export async function deleteGuestKioskInstallations(
  deviceId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin
    .from("restaurant_guest_kiosk_installations")
    .delete()
    .eq("device_id", deviceId);
  await admin
    .from("restaurant_guest_kiosk_pairing_codes")
    .delete()
    .eq("device_id", deviceId);
}

export function normalizeMollieTerminalId(
  raw: string | null | undefined,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  return trimmed.startsWith("term_") ? trimmed : null;
}

/** Restaurant fallback or any active device with a terminal. */
export async function restaurantHasAnyKioskTerminal(
  restaurantId: string,
  restaurantFallback: string | null,
): Promise<boolean> {
  if (restaurantFallback) return true;
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from("restaurant_guest_kiosk_devices")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .not("mollie_terminal_id", "is", null)
    .limit(1);
  return Boolean(data?.length);
}
