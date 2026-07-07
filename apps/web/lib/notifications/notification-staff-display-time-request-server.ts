import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DisplayTimeRequestEntryType } from "@/lib/staff/staff-display-time-request-types";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import {
  formatDisplayTimeRequestRangeLabel,
  loadRestaurantTimezone,
} from "@/lib/staff/staff-display-time-request-server";
import { staffFamilyFirstDisplayName } from "@/lib/types/staff";

async function fetchDismissedRequestIds(
  sb: SupabaseClient,
  params: {
    profileId: string;
    restaurantId: string;
  },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_staff_display_time_request_notification_dismissals")
    .select("request_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId);

  return new Set(
    (data ?? []).map((row) => (row as { request_id: string }).request_id),
  );
}

export async function loadStaffDisplayTimeRequestNotificationItems(
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

  const admin = sb;
  const { data, error } = await admin
    .from("restaurant_staff_display_time_requests")
    .select(
      `
      id,
      entry_type,
      requested_starts_at,
      requested_ends_at,
      created_at,
      staff:restaurant_staff ( given_name, family_name )
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 5), 100));

  if (error) {
    console.warn("[gwada] staff display time request bell", error.message);
    return { items: [], totalCount: 0 };
  }

  const timeZone = await loadRestaurantTimezone(admin, params.restaurantId);
  const def = NOTIFICATION_MODULES.staff_display_time_request;

  const rows = (data ?? []).filter(
    (row) => !dismissed.has((row as { id: string }).id),
  );

  const items = rows.slice(0, limit).map((row) => {
    const r = row as {
      id: string;
      entry_type: DisplayTimeRequestEntryType;
      requested_starts_at: string;
      requested_ends_at: string;
      created_at: string;
      staff: { given_name: string; family_name: string } | { given_name: string; family_name: string }[] | null;
    };
    const staffRel = Array.isArray(r.staff) ? r.staff[0] : r.staff;
    const name = staffRel
      ? staffFamilyFirstDisplayName(staffRel)
      : "Mitarbeiter";
    const rangeLabel = formatDisplayTimeRequestRangeLabel(r, timeZone);

    return {
      id: r.id,
      title: "Zeit nachtragen",
      subtitle: `${name} · ${rangeLabel}`,
      href: def.href,
      at: r.created_at,
      meta: { requestId: r.id },
    };
  });

  return { items, totalCount: rows.length };
}

export async function dismissStaffDisplayTimeRequestNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    requestId: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_staff_display_time_request_notification_dismissals")
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

export async function dismissAllStaffDisplayTimeRequestNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
  },
): Promise<{ error: string | null }> {
  const { data: pending } = await sb
    .from("restaurant_staff_display_time_requests")
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
    .from("restaurant_staff_display_time_request_notification_dismissals")
    .upsert(rows, {
      onConflict: "profile_id,restaurant_id,request_id",
    });

  return { error: error?.message ?? null };
}
