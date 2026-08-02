import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RESTAURANT_WORKSPACE_QUOTA_BYTES,
} from "@/lib/constants/workspace-storage";

export async function fetchWorkspaceQuotaBytes(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { data, error } = await sb.rpc("restaurant_workspace_quota_bytes", {
    p_restaurant_id: restaurantId,
  });
  if (error) {
    return RESTAURANT_WORKSPACE_QUOTA_BYTES;
  }
  const n = Number(data ?? RESTAURANT_WORKSPACE_QUOTA_BYTES);
  return Number.isFinite(n) && n > 0 ? n : RESTAURANT_WORKSPACE_QUOTA_BYTES;
}

export async function assertWorkspaceStorageAvailable(
  sb: SupabaseClient,
  restaurantId: string,
  additionalBytes: number,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const [{ data, error }, quotaBytes] = await Promise.all([
    sb.rpc("restaurant_workspace_used_bytes", {
      p_restaurant_id: restaurantId,
    }),
    fetchWorkspaceQuotaBytes(sb, restaurantId),
  ]);
  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }
  const used = Number(data ?? 0);
  if (used + additionalBytes > quotaBytes) {
    return { ok: false, error: "storage_quota_exceeded", status: 413 };
  }
  return { ok: true };
}
