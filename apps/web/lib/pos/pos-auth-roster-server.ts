import "server-only";

import {
  staffCanUsePos,
  staffPosPermissionKeys,
  type PosDeviceRow,
} from "@/lib/pos/pos-device-auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { posDisplayPinOfflineHash } from "@/lib/pos/pos-offline-pin";

export type PosAuthRosterStaff = {
  id: string;
  given_name: string;
  family_name: string;
  profile_id: string | null;
  position_name: string | null;
  offline_pin_hash: string;
  permissions: string[];
};

export async function buildPosAuthRoster(
  device: PosDeviceRow,
): Promise<{ fetchedAt: string; staff: PosAuthRosterStaff[] }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { fetchedAt: new Date().toISOString(), staff: [] };
  }

  const { data: rows } = await admin
    .from("restaurant_staff")
    .select(
      `
      id,
      given_name,
      family_name,
      profile_id,
      display_pin_offline_hash,
      restaurant_position:restaurant_positions ( name )
    `,
    )
    .eq("restaurant_id", device.restaurant_id)
    .eq("is_active", true)
    .not("display_pin_hash", "is", null);

  const staff: PosAuthRosterStaff[] = [];

  for (const row of rows ?? []) {
    const keys = await staffPosPermissionKeys(row.id as string);
    if (!staffCanUsePos(keys)) continue;

    let offlineHash = (row.display_pin_offline_hash as string | null)?.trim() ?? "";
    if (!offlineHash) continue;

    const position = row.restaurant_position as
      | { name?: string }
      | { name?: string }[]
      | null;
    const positionName = Array.isArray(position)
      ? (position[0]?.name ?? null)
      : (position?.name ?? null);

    staff.push({
      id: row.id as string,
      given_name: (row.given_name as string) ?? "",
      family_name: (row.family_name as string) ?? "",
      profile_id: (row.profile_id as string | null) ?? null,
      position_name: positionName,
      offline_pin_hash: offlineHash,
      permissions: Array.from(keys),
    });
  }

  return { fetchedAt: new Date().toISOString(), staff };
}

export async function backfillPosOfflinePinHash(params: {
  staffId: string;
  restaurantId: string;
  pin: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const hash = posDisplayPinOfflineHash(params.pin, params.restaurantId);
  await admin
    .from("restaurant_staff")
    .update({ display_pin_offline_hash: hash })
    .eq("id", params.staffId)
    .eq("restaurant_id", params.restaurantId);
}
