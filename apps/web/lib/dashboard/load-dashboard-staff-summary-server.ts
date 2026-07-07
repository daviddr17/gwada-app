import "server-only";

import { computeDashboardStaffSummary } from "@/lib/staff/compute-dashboard-staff-summary";
import type { DashboardStaffSummaryPayload } from "@/lib/dashboard/dashboard-staff-summary-types";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  localDayStartToUtcIso,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import type {
  RestaurantStaffRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import type { SupabaseClient } from "@supabase/supabase-js";

const STAFF_SELECT = `
  id,
  restaurant_id,
  profile_id,
  employee_id,
  position_tag_id,
  restaurant_position_id,
  given_name,
  family_name,
  birth_date,
  nationality,
  address_line1,
  address_line2,
  postal_code,
  city,
  country,
  email,
  phone,
  is_active,
  avatar_storage_path,
  created_at,
  position_tag:restaurant_staff_position_tags (
    id,
    name,
    background_color,
    is_active
  ),
  restaurant_position:restaurant_positions (
    id,
    name,
    slug
  ),
  linked_profile:profiles!profile_id (
    given_name,
    family_name,
    display_name,
    last_seen_at
  ),
  linked_employee:restaurant_employees!employee_id (
    id,
    role,
    is_active,
    restaurant_position:restaurant_positions!position_id (
      id,
      name,
      slug
    )
  )
`;

function mapStaffRow(r: Record<string, unknown>): RestaurantStaffRow {
  const tagRaw = r.position_tag as
    | { id: string; name: string; background_color: string; is_active: boolean }
    | { id: string; name: string; background_color: string; is_active: boolean }[]
    | null;
  const tagOne = Array.isArray(tagRaw) ? (tagRaw[0] ?? null) : tagRaw;
  const posRaw = r.restaurant_position as
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
  const posOne = Array.isArray(posRaw) ? (posRaw[0] ?? null) : posRaw;
  const profileRaw = r.linked_profile as
    | {
        given_name: string | null;
        family_name: string | null;
        display_name: string | null;
        last_seen_at: string | null;
      }
    | {
        given_name: string | null;
        family_name: string | null;
        display_name: string | null;
        last_seen_at: string | null;
      }[]
    | null;
  const profileOne = Array.isArray(profileRaw) ? (profileRaw[0] ?? null) : profileRaw;
  const empRaw = r.linked_employee as
    | {
        id: string;
        role: string;
        is_active: boolean;
        restaurant_position:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null;
      }
    | {
        id: string;
        role: string;
        is_active: boolean;
        restaurant_position:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null;
      }[]
    | null;
  const empOne = Array.isArray(empRaw) ? (empRaw[0] ?? null) : empRaw;
  const empPosRaw = empOne?.restaurant_position;
  const empPosOne = Array.isArray(empPosRaw) ? (empPosRaw[0] ?? null) : (empPosRaw ?? null);

  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    profile_id: (r.profile_id as string | null) ?? null,
    employee_id: (r.employee_id as string | null) ?? null,
    position_tag_id: (r.position_tag_id as string | null) ?? null,
    restaurant_position_id: (r.restaurant_position_id as string | null) ?? null,
    given_name: r.given_name as string,
    family_name: r.family_name as string,
    birth_date: (r.birth_date as string | null) ?? null,
    nationality: (r.nationality as string | null) ?? null,
    address_line1: (r.address_line1 as string | null) ?? null,
    address_line2: (r.address_line2 as string | null) ?? null,
    postal_code: (r.postal_code as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    is_active: Boolean(r.is_active),
    avatar_storage_path: (r.avatar_storage_path as string | null) ?? null,
    created_at: r.created_at as string,
    position_tag: tagOne
      ? {
          id: tagOne.id,
          name: tagOne.name,
          background_color: tagOne.background_color,
          is_active: tagOne.is_active,
        }
      : null,
    restaurant_position: posOne
      ? { id: posOne.id, name: posOne.name, slug: posOne.slug }
      : null,
    linked_profile: profileOne
      ? {
          given_name: profileOne.given_name,
          family_name: profileOne.family_name,
          display_name: profileOne.display_name,
          last_seen_at: profileOne.last_seen_at ?? null,
        }
      : null,
    linked_employee: empOne
      ? {
          id: empOne.id,
          role: empOne.role,
          is_active: empOne.is_active,
          restaurant_position: empPosOne
            ? {
                id: empPosOne.id,
                name: empPosOne.name,
                slug: empPosOne.slug,
              }
            : null,
        }
      : null,
  };
}

async function fetchStaffLivePresenceServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<StaffLivePresenceRow[]> {
  const { data: openEntries, error } = await sb
    .from("restaurant_staff_work_entries")
    .select("staff_id, shift_id, entry_type, starts_at")
    .eq("restaurant_id", restaurantId)
    .eq("is_open", true)
    .not("shift_id", "is", null);

  if (error) throw new Error(error.message);

  const shiftIds = [
    ...new Set(
      (openEntries ?? [])
        .map((row) => row.shift_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const shiftClockInById = new Map<string, string>();
  if (shiftIds.length > 0) {
    const { data: shiftRows, error: shiftErr } = await sb
      .from("restaurant_staff_work_entries")
      .select("shift_id, starts_at")
      .in("shift_id", shiftIds)
      .order("starts_at", { ascending: true });
    if (shiftErr) throw new Error(shiftErr.message);
    for (const row of shiftRows ?? []) {
      const shiftId = row.shift_id as string;
      if (!shiftClockInById.has(shiftId)) {
        shiftClockInById.set(shiftId, row.starts_at as string);
      }
    }
  }

  const byStaff = new Map<string, StaffLivePresenceRow>();
  for (const row of openEntries ?? []) {
    const staffId = row.staff_id as string;
    const shiftId = row.shift_id as string;
    const entryType = row.entry_type as "work" | "break";
    const startsAt = row.starts_at as string;
    const clockedInAt = shiftClockInById.get(shiftId) ?? startsAt;
    byStaff.set(staffId, {
      staff_id: staffId,
      status: entryType === "break" ? "on_break" : "working",
      clocked_in_at: clockedInAt,
      break_started_at: entryType === "break" ? startsAt : null,
    });
  }

  return [...byStaff.values()];
}

async function fetchStaffWorkEntriesTodayServer(
  sb: SupabaseClient,
  restaurantId: string,
) {
  const today = startOfLocalDay(new Date());
  const rangeStart = localDayStartToUtcIso(today);
  const rangeEnd = exclusiveUtcIsoAfterLocalVisibleEnd(today);

  const { data: closed, error: closedErr } = await sb
    .from("restaurant_staff_work_entries")
    .select(
      "id, restaurant_id, staff_id, entry_type, starts_at, ends_at, note, is_open, shift_id",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_open", false)
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd);

  if (closedErr) throw new Error(closedErr.message);

  const { data: open, error: openErr } = await sb
    .from("restaurant_staff_work_entries")
    .select(
      "id, restaurant_id, staff_id, entry_type, starts_at, ends_at, note, is_open, shift_id",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_open", true)
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd);

  if (openErr) throw new Error(openErr.message);

  const mapRow = (r: Record<string, unknown>) => ({
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    staff_id: r.staff_id as string,
    entry_type: r.entry_type as "work" | "break",
    starts_at: r.starts_at as string,
    ends_at: r.ends_at as string,
    note: (r.note as string | null) ?? null,
    is_open: Boolean(r.is_open),
    shift_id: (r.shift_id as string | null) ?? null,
  });

  const byId = new Map<string, ReturnType<typeof mapRow>>();
  for (const r of [...(closed ?? []), ...(open ?? [])]) {
    const row = mapRow(r as Record<string, unknown>);
    byId.set(row.id, row);
  }

  return [...byId.values()].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
}

export async function loadDashboardStaffSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardStaffSummaryPayload> {
  const { data: staffRows, error: staffErr } = await sb
    .from("restaurant_staff")
    .select(STAFF_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("family_name", { ascending: true })
    .order("given_name", { ascending: true });

  if (staffErr) throw new Error(staffErr.message);

  const staff = (staffRows ?? []).map((r) =>
    mapStaffRow(r as Record<string, unknown>),
  );

  const [presence, todayEntries] = await Promise.all([
    fetchStaffLivePresenceServer(sb, restaurantId),
    fetchStaffWorkEntriesTodayServer(sb, restaurantId),
  ]);

  return {
    staff,
    presence,
    summary: computeDashboardStaffSummary({
      staff,
      presence,
      todayEntries,
    }),
  };
}
