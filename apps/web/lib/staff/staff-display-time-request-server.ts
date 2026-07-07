import "server-only";

import {
  readRestaurantZonedParts,
  restaurantZonedDateKey,
  utcInstantForRestaurantLocal,
} from "@/lib/restaurant/restaurant-timezone";
import {
  DISPLAY_TIME_REQUEST_ENTRY_TYPES,
  isDisplayTimeRequestEntryType,
  type DisplayTimeRequestEntryType,
} from "@/lib/staff/staff-display-time-request-types";
import { STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffDisplayTimeRequestStatus = "pending" | "approved" | "declined";

export type StaffDisplayTimeRequestRow = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  entry_type: DisplayTimeRequestEntryType;
  requested_starts_at: string;
  requested_ends_at: string;
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

function parseTimeParts(timeValue: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeValue.trim());
  if (!match) return null;
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
    return null;
  }
  return { hour, minute };
}

function parseDateYmd(dateYmd: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return { year, month, day };
}

export function parseDisplayTimeRequestRange(
  params: {
    dateYmd: string;
    startTime: string;
    endTime: string;
    entryType: string;
  },
  ref: Date,
  timeZone: string,
):
  | {
      ok: true;
      entryType: DisplayTimeRequestEntryType;
      startsAt: string;
      endsAt: string;
    }
  | { ok: false; error: string } {
  if (!isDisplayTimeRequestEntryType(params.entryType)) {
    return { ok: false, error: "invalid_entry_type" };
  }

  const dateParts = parseDateYmd(params.dateYmd);
  const startParts = parseTimeParts(params.startTime);
  const endParts = parseTimeParts(params.endTime);
  if (!dateParts || !startParts || !endParts) {
    return { ok: false, error: "invalid_request" };
  }

  const startsAt = utcInstantForRestaurantLocal(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    startParts.hour,
    startParts.minute,
    timeZone,
  );
  const endsAt = utcInstantForRestaurantLocal(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    endParts.hour,
    endParts.minute,
    timeZone,
  );

  const startMs = startsAt.getTime();
  const endMs = endsAt.getTime();
  const now = ref.getTime();

  if (endMs <= startMs) {
    return { ok: false, error: "end_before_start" };
  }

  const refDayKey = restaurantZonedDateKey(ref, timeZone);
  const requestDayKey = restaurantZonedDateKey(startsAt, timeZone);
  if (requestDayKey > refDayKey) {
    return { ok: false, error: "date_in_future" };
  }

  if (endMs > now + 2 * 60_000) {
    return { ok: false, error: "time_in_future" };
  }

  return {
    ok: true,
    entryType: params.entryType,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

export async function listPendingDisplayTimeRequestsForStaff(
  admin: SupabaseClient,
  staffId: string,
): Promise<StaffDisplayTimeRequestRow[]> {
  const { data } = await admin
    .from("restaurant_staff_display_time_requests")
    .select("*")
    .eq("staff_id", staffId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (data as StaffDisplayTimeRequestRow[] | null) ?? [];
}

/** @deprecated Use listPendingDisplayTimeRequestsForStaff */
export async function findPendingDisplayTimeRequest(
  admin: SupabaseClient,
  staffId: string,
): Promise<StaffDisplayTimeRequestRow | null> {
  const rows = await listPendingDisplayTimeRequestsForStaff(admin, staffId);
  return rows[0] ?? null;
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

export async function createDisplayTimeRequest(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    staffId: string;
    entryType: DisplayTimeRequestEntryType;
    requestedStartsAt: string;
    requestedEndsAt: string;
  },
): Promise<
  | { ok: true; request: StaffDisplayTimeRequestRow }
  | { ok: false; error: string; status: number }
> {
  const { data, error } = await admin
    .from("restaurant_staff_display_time_requests")
    .insert({
      restaurant_id: params.restaurantId,
      staff_id: params.staffId,
      entry_type: params.entryType,
      requested_starts_at: params.requestedStartsAt,
      requested_ends_at: params.requestedEndsAt,
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
      entryType: params.entryType,
      requestedStartsAt: params.requestedStartsAt,
      requestedEndsAt: params.requestedEndsAt,
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

  const { data: entry, error: entryErr } = await admin
    .from("restaurant_staff_work_entries")
    .insert({
      restaurant_id: params.restaurantId,
      staff_id: request.staff_id,
      entry_type: request.entry_type,
      starts_at: request.requested_starts_at,
      ends_at: request.requested_ends_at,
      is_open: false,
      shift_id: null,
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

export function formatDisplayTimeRequestLocalDate(
  iso: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDisplayTimeRequestRangeLabel(
  row: Pick<
    StaffDisplayTimeRequestRow,
    "entry_type" | "requested_starts_at" | "requested_ends_at"
  >,
  timeZone: string,
): string {
  const typeLabel = STAFF_WORK_ENTRY_LABELS[row.entry_type];
  const dateLabel = formatDisplayTimeRequestLocalDate(row.requested_starts_at, timeZone);
  const from = formatDisplayTimeRequestLocalTime(row.requested_starts_at, timeZone);
  const to = formatDisplayTimeRequestLocalTime(row.requested_ends_at, timeZone);
  return `${typeLabel} · ${dateLabel} · ${from}–${to}`;
}

export { DISPLAY_TIME_REQUEST_ENTRY_TYPES };
