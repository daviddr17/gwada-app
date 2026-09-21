import "server-only";

import { registeredUserSeatCap } from "@/lib/billing/registered-user-seats";
import { loadRestaurantEntitlements } from "@/lib/billing/subscription-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function countActiveRegisteredUsers(
  restaurantId: string,
): Promise<number> {
  const admin = createSupabaseAdminClient();
  if (!admin) return 0;
  const { count, error } = await admin
    .from("restaurant_employees")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true);
  if (error) {
    console.warn("countActiveRegisteredUsers", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function countPendingStaffInvites(
  restaurantId: string,
  excludeStaffId?: string,
): Promise<number> {
  const admin = createSupabaseAdminClient();
  if (!admin) return 0;
  const nowIso = new Date().toISOString();
  let query = admin
    .from("restaurant_staff_invites")
    .select("id, staff_id", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .gt("expires_at", nowIso);
  if (excludeStaffId) {
    query = query.neq("staff_id", excludeStaffId);
  }
  const { data, error } = await query;
  if (error) {
    console.warn("countPendingStaffInvites", error.message);
    return 0;
  }
  const staffIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.staff_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (staffIds.length === 0) return 0;
  const { data: staffRows } = await admin
    .from("restaurant_staff")
    .select("id, profile_id")
    .in("id", staffIds);
  const unlinked = new Set(
    (staffRows ?? [])
      .filter((row) => !row.profile_id)
      .map((row) => row.id as string),
  );
  return (data ?? []).filter((row) => unlinked.has(row.staff_id as string))
    .length;
}

export async function assertCanAddRegisteredUser(input: {
  restaurantId: string;
  /** Re-Invite derselben Person verbraucht keinen extra Slot. */
  existingStaffId?: string;
}): Promise<{ ok: true } | { ok: false; error: "user_limit"; limit: number }> {
  const entitlements = await loadRestaurantEntitlements(input.restaurantId);
  const cap = registeredUserSeatCap(entitlements);
  if (cap == null) {
    return { ok: true };
  }
  const used =
    (await countActiveRegisteredUsers(input.restaurantId)) +
    (await countPendingStaffInvites(
      input.restaurantId,
      input.existingStaffId,
    ));
  if (used >= cap) {
    return { ok: false, error: "user_limit", limit: cap };
  }
  return { ok: true };
}
