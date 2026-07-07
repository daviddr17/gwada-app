import "server-only";

import { randomUUID } from "crypto";
import {
  readRestaurantZonedParts,
  restaurantZonedDateKey,
  startOfRestaurantCalendarDay,
  utcInstantForRestaurantLocal,
} from "@/lib/restaurant/restaurant-timezone";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffDisplayTimeRequestStatus = "pending" | "approved" | "declined";

export type StaffDisplayTimeRequestRow = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  requested_starts_at: string;
  status: StaffDisplayTimeRequestStatus;
  work_entry_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  display_acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffDisplayTimeRequestListItem = StaffDisplayTimeRequestRow & {
  staff: {
    given_name: string;
    family_name: string;
    avatar_storage_path: string | null;
  };
};

const DISPLAY_NOTE = "Display";

export async function loadRestaurantTimezone(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string> {
  const { data } = await admin
    .from("restaurants")
    .select("timezone")
    .eq("id", restaurantId)
    .maybeSingle();
  const tz = (data as { timezone?: string } | null)?.timezone?.trim();
  return tz || "Europe/Berlin";
}

export function parseDisplayTimeRequestLocalTime(
  timeValue: string,
  ref: Date,
  timeZone: string,
): { ok: true; iso: string } | { ok: false; error: string } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeValue.trim());
  if (!match) {
    return { ok: false, error: "invalid_time" };
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return { ok: false, error: "invalid_time" };
  }

  const z = readRestaurantZonedParts(ref, timeZone);
  const requestedAt = utcInstantForRestaurantLocal(
    z.year,
    z.month,
    z.day,
    hour,
    minute,
    timeZone,
  );
  const now = ref.getTime();
  const requestedMs = requestedAt.getTime();

  if (requestedMs > now + 2 * 60_000) {
    return { ok: false, error: "time_in_future" };
  }

  const dayStart = startOfRestaurantCalendarDay(ref, timeZone).getTime();
  if (requestedMs < dayStart) {
    return { ok: false, error: "time_before_today" };
  }

  return { ok: true, iso: requestedAt.toISOString() };
}

export async function findPendingDisplayTimeRequest(
  admin: SupabaseClient,
  staffId: string,
): Promise<StaffDisplayTimeRequestRow | null> {
  const { data } = await admin
    .from("restaurant_staff_display_time_requests")
    .select("*")
    .eq("staff_id", staffId)
    .eq("status", "pending")
    .maybeSingle();

  return (data as StaffDisplayTimeRequestRow | null) ?? null;
}

export async function listUnacknowledgedDisplayTimeResolutions(
  admin: SupabaseClient,
  staffId: string,
): Promise<StaffDisplayTimeRequestRow[]> {
  const { data } = await admin
    .from("restaurant_staff_display_time_requests")
    .select("*")
    .eq("staff_id", staffId)
    .in("status", ["approved", "declined"])
    .is("display_acknowledged_at", null)
    .order("reviewed_at", { ascending: false })
    .limit(5);

  return (data as StaffDisplayTimeRequestRow[] | null) ?? [];
}

export async function listPendingDisplayTimeRequestsForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<StaffDisplayTimeRequestListItem[]> {
  const { data, error } = await admin
    .from("restaurant_staff_display_time_requests")
    .select(
      `
      *,
      staff:restaurant_staff (
        given_name,
        family_name,
        avatar_storage_path
      )
    `,
    )
    .eq("restaurant_id", restaurantId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[gwada] list display time requests", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) => {
      const staffRaw = (row as Record<string, unknown>).staff;
      const staffOne = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw;
      if (!staffOne || typeof staffOne !== "object") return null;
      const staff = staffOne as {
        given_name: string;
        family_name: string;
        avatar_storage_path: string | null;
      };
      const { staff: _omit, ...request } = row as Record<string, unknown>;
      return {
        ...(request as StaffDisplayTimeRequestRow),
        staff,
      };
    })
    .filter((row): row is StaffDisplayTimeRequestListItem => row != null);
}

async function staffHasOpenDisplayShift(
  admin: SupabaseClient,
  staffId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("restaurant_staff_work_entries")
    .select("id")
    .eq("staff_id", staffId)
    .eq("is_open", true)
    .not("shift_id", "is", null)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function createDisplayTimeRequest(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    requestedStartsAt: string;
  },
): Promise<
  | { ok: true; request: StaffDisplayTimeRequestRow }
  | { ok: false; error: string; status: number }
> {
  if (await staffHasOpenDisplayShift(admin, params.staffId)) {
    return { ok: false, error: "already_clocked_in", status: 409 };
  }

  const pending = await findPendingDisplayTimeRequest(admin, params.staffId);
  if (pending) {
    return { ok: false, error: "request_already_pending", status: 409 };
  }

  const { data, error } = await admin
    .from("restaurant_staff_display_time_requests")
    .insert({
      restaurant_id: params.restaurantId,
      staff_id: params.staffId,
      requested_starts_at: params.requestedStartsAt,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[gwada] create display time request", error?.message);
    return { ok: false, error: "create_failed", status: 500 };
  }

  await admin.from("notification_events").insert({
    restaurant_id: params.restaurantId,
    module: "staff_display_time_request",
    reference_id: (data as StaffDisplayTimeRequestRow).id,
    payload: {
      requestId: (data as StaffDisplayTimeRequestRow).id,
      staffId: params.staffId,
      requestedStartsAt: params.requestedStartsAt,
    },
  });

  return { ok: true, request: data as StaffDisplayTimeRequestRow };
}

export async function acknowledgeDisplayTimeRequestResolutions(
  admin: SupabaseClient,
  params: {
    staffId: string;
    requestIds: string[];
  },
): Promise<void> {
  if (params.requestIds.length === 0) return;
  const now = new Date().toISOString();
  await admin
    .from("restaurant_staff_display_time_requests")
    .update({ display_acknowledged_at: now })
    .eq("staff_id", params.staffId)
    .in("id", params.requestIds)
    .is("display_acknowledged_at", null);
}

export async function reviewDisplayTimeRequest(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    requestId: string;
    actorUserId: string;
    decision: "approve" | "decline";
  },
): Promise<
  | { ok: true; request: StaffDisplayTimeRequestRow }
  | { ok: false; error: string; status: number }
> {
  const { data: row, error: loadErr } = await admin
    .from("restaurant_staff_display_time_requests")
    .select("*")
    .eq("id", params.requestId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (loadErr || !row) {
    return { ok: false, error: "not_found", status: 404 };
  }

  const request = row as StaffDisplayTimeRequestRow;
  if (request.status !== "pending") {
    return { ok: false, error: "not_pending", status: 409 };
  }

  const now = new Date().toISOString();

  if (params.decision === "decline") {
    const { data: declined, error } = await admin
      .from("restaurant_staff_display_time_requests")
      .update({
        status: "declined",
        reviewed_by: params.actorUserId,
        reviewed_at: now,
      })
      .eq("id", params.requestId)
      .select("*")
      .single();

    if (error || !declined) {
      return { ok: false, error: "update_failed", status: 500 };
    }
    return { ok: true, request: declined as StaffDisplayTimeRequestRow };
  }

  if (await staffHasOpenDisplayShift(admin, request.staff_id)) {
    return { ok: false, error: "staff_already_clocked_in", status: 409 };
  }

  const shiftId = randomUUID();
  const startsAt = request.requested_starts_at;
  const { data: entry, error: entryErr } = await admin
    .from("restaurant_staff_work_entries")
    .insert({
      restaurant_id: params.restaurantId,
      staff_id: request.staff_id,
      entry_type: "work",
      starts_at: startsAt,
      ends_at: startsAt,
      is_open: true,
      shift_id: shiftId,
      note: DISPLAY_NOTE,
      created_by: params.actorUserId,
    })
    .select("id")
    .single();

  if (entryErr || !entry) {
    console.warn("[gwada] approve display time request entry", entryErr?.message);
    return { ok: false, error: "entry_create_failed", status: 500 };
  }

  const { data: approved, error: approveErr } = await admin
    .from("restaurant_staff_display_time_requests")
    .update({
      status: "approved",
      work_entry_id: entry.id as string,
      reviewed_by: params.actorUserId,
      reviewed_at: now,
    })
    .eq("id", params.requestId)
    .select("*")
    .single();

  if (approveErr || !approved) {
    return { ok: false, error: "update_failed", status: 500 };
  }

  return { ok: true, request: approved as StaffDisplayTimeRequestRow };
}

export function formatDisplayTimeRequestLocalTime(
  iso: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function isDisplayTimeRequestSameDay(
  iso: string,
  ref: Date,
  timeZone: string,
): boolean {
  return restaurantZonedDateKey(new Date(iso), timeZone) === restaurantZonedDateKey(ref, timeZone);
}
