import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import { staffFamilyFirstDisplayName } from "@/lib/types/staff";

async function fetchDismissedRequestIds(
  sb: SupabaseClient,
  params: {
    profileId: string;
    restaurantId: string;
  },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_staff_profile_change_request_notification_dismissals")
    .select("request_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId);

  return new Set(
    (data ?? []).map((row) => (row as { request_id: string }).request_id),
  );
}

export async function loadStaffProfileChangeRequestNotificationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    limit?: number;
  },
) {
  const limit = params.limit ?? 5;
  const dismissed = await fetchDismissedRequestIds(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
  });

  const { data, error } = await sb
    .from("restaurant_staff_profile_change_requests")
    .select(
      `
      id,
      proposed_fields,
      created_at,
      staff:restaurant_staff ( given_name, family_name )
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 5), 100));

  if (error) {
    console.warn("[gwada] staff profile change request bell", error.message);
    return { items: [], totalCount: 0 };
  }

  const def = NOTIFICATION_MODULES.staff_profile_change_request;

  const rows = (data ?? []).filter(
    (row) => !dismissed.has((row as { id: string }).id),
  );

  const items = rows.slice(0, limit).map((row) => {
    const r = row as {
      id: string;
      created_at: string;
      staff:
        | { given_name: string; family_name: string }
        | { given_name: string; family_name: string }[]
        | null;
    };
    const staffRel = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    const name = staffRel
      ? staffFamilyFirstDisplayName(staffRel)
      : "Mitarbeiter";

    return {
      id: r.id,
      title: "Profiländerung",
      subtitle: `${name} · vom Display`,
      href: def.href,
      at: r.created_at,
      meta: { requestId: r.id },
    };
  });

  return { items, totalCount: rows.length };
}

export async function dismissStaffProfileChangeRequestNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    requestId: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_staff_profile_change_request_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        request_id: params.requestId,
      },
      {
        onConflict: "profile_id,restaurant_id,request_id",
      },
    );

  return { error: error?.message ?? null };
}

export async function dismissAllStaffProfileChangeRequestNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
  },
): Promise<{ error: string | null }> {
  const { data: pending } = await sb
    .from("restaurant_staff_profile_change_requests")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "pending");

  if (!pending?.length) return { error: null };

  const rows = pending.map((row) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    request_id: (row as { id: string }).id,
  }));

  const { error } = await sb
    .from("restaurant_staff_profile_change_request_notification_dismissals")
    .upsert(rows, {
      onConflict: "profile_id,restaurant_id,request_id",
    });

  return { error: error?.message ?? null };
}
