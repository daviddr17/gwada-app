import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type RestaurantPendingStaffInviteRow = {
  invite_id: string;
  staff_id: string;
  staff_given_name: string | null;
  staff_family_name: string | null;
  staff_email: string | null;
  staff_phone: string | null;
  position_name: string | null;
  channel: string;
  expires_at: string;
  created_at: string;
};

export async function listPendingStaffInvitesForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantPendingStaffInviteRow[]> {
  const { data, error } = await admin.rpc("list_restaurant_pending_staff_invites", {
    p_restaurant_id: restaurantId,
  });

  if (error) {
    console.warn("[gwada] list_restaurant_pending_staff_invites", error.message);
    return [];
  }

  return (data ?? []) as RestaurantPendingStaffInviteRow[];
}
