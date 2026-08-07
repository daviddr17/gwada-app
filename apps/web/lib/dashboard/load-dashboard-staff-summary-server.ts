import "server-only";

import { computeDashboardStaffSummary } from "@/lib/staff/compute-dashboard-staff-summary";
import { listCompletedDisplayShifts } from "@/lib/staff/staff-work-hours-display";
import type { DashboardStaffSummaryPayload } from "@/lib/dashboard/dashboard-staff-summary-types";
import {
  restaurantDayBoundsIso,
  restaurantTodayYmd,
} from "@/lib/restaurant/restaurant-timezone";
import { computeStaffDayWageBreakdown } from "@/lib/staff/staff-day-wage";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import type {
  RestaurantStaffContractRow,
  RestaurantStaffRow,
  StaffLivePresenceRow,
} from "@/lib/types/staff";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Dashboard-KPI/Sheets — ohne Adress-/Vertrags-Joins der Mitarbeiterliste. */
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
  is_active,
  avatar_storage_path,
  created_at,
  position_tag:restaurant_staff_position_tags (
    id,
    name,
    background_color,
    is_active
  ),
  linked_profile:profiles!profile_id (
    given_name,
    family_name,
    display_name,
    last_seen_at
  )
`;

function mapStaffRow(r: Record<string, unknown>): RestaurantStaffRow {
  const tagRaw = r.position_tag as
    | { id: string; name: string; background_color: string; is_active: boolean }
    | { id: string; name: string; background_color: string; is_active: boolean }[]
    | null;
  const tagOne = Array.isArray(tagRaw) ? (tagRaw[0] ?? null) : tagRaw;
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
    nationality: null,
    address_line1: null,
    address_line2: null,
    postal_code: null,
    city: null,
    country: null,
    email: null,
    phone: null,
    is_active: Boolean(r.is_active),
    avatar_storage_path: (r.avatar_storage_path as string | null) ?? null,
    created_at: r.created_at as string,
    display_pin_set_at: null,
    position_tag: tagOne
      ? {
          id: tagOne.id,
          name: tagOne.name,
          background_color: tagOne.background_color,
          is_active: tagOne.is_active,
        }
      : null,
    restaurant_position: null,
    linked_profile: profileOne
      ? {
          given_name: profileOne.given_name,
          family_name: profileOne.family_name,
          display_name: profileOne.display_name,
          last_seen_at: profileOne.last_seen_at ?? null,
        }
      : null,
    linked_employee: null,
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
  timeZone: string,
) {
  const { start: rangeStart, end: rangeEnd } = restaurantDayBoundsIso(
    null,
    timeZone,
  );

  // Überlappung mit dem Restaurant-Tag — nicht nur starts_at im Tag.
  // Sonst fehlen Übernacht-Anteile von gestern (Morgenstunden) im Heute-Widget.
  const { data: closed, error: closedErr } = await sb
    .from("restaurant_staff_work_entries")
    .select(
      "id, restaurant_id, staff_id, entry_type, starts_at, ends_at, note, is_open, shift_id",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_open", false)
    .lt("starts_at", rangeEnd)
    .gt("ends_at", rangeStart);

  if (closedErr) throw new Error(closedErr.message);

  // Offene Segmente: Übernacht von gestern + heute. Lookback begrenzt Geister-Stempel.
  const openLookbackStart = new Date(
    Date.parse(rangeStart) - 36 * 3_600_000,
  ).toISOString();

  const { data: open, error: openErr } = await sb
    .from("restaurant_staff_work_entries")
    .select(
      "id, restaurant_id, staff_id, entry_type, starts_at, ends_at, note, is_open, shift_id",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_open", true)
    .gte("starts_at", openLookbackStart)
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

/** Minimaler Contract-Stand für Tageslohn — ohne Dokument-/Signatur-Felder. */
async function fetchStaffContractsForWageServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantStaffContractRow[]> {
  const { data, error } = await sb
    .from("restaurant_staff_contracts")
    .select(
      "id, restaurant_id, staff_id, valid_from, valid_to, pay_type, hourly_rate_cents, fixed_salary_cents, currency, note, employment_type_id, vacation_days_per_year, target_weekly_minutes",
    )
    .eq("restaurant_id", restaurantId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const validFrom = String(row.valid_from ?? "").slice(0, 10);
    const validToRaw = row.valid_to as string | null | undefined;
    return {
      id: row.id as string,
      restaurant_id: row.restaurant_id as string,
      staff_id: row.staff_id as string,
      valid_from: validFrom,
      valid_to: validToRaw ? validToRaw.slice(0, 10) : null,
      pay_type: row.pay_type as RestaurantStaffContractRow["pay_type"],
      hourly_rate_cents: (row.hourly_rate_cents as number | null) ?? null,
      fixed_salary_cents: (row.fixed_salary_cents as number | null) ?? null,
      currency: (row.currency as string) ?? "EUR",
      note: (row.note as string | null) ?? null,
      employment_type_id: (row.employment_type_id as string | null) ?? null,
      vacation_days_per_year:
        (row.vacation_days_per_year as number | null) ?? null,
      target_weekly_minutes:
        typeof row.target_weekly_minutes === "number"
          ? row.target_weekly_minutes
          : null,
    };
  });
}

export async function loadDashboardStaffSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardStaffSummaryPayload> {
  const [staffResult, timeZone, presence, contracts] = await Promise.all([
    sb
      .from("restaurant_staff")
      .select(STAFF_SELECT)
      .eq("restaurant_id", restaurantId)
      .order("family_name", { ascending: true })
      .order("given_name", { ascending: true }),
    fetchRestaurantTimezoneServer(sb, restaurantId),
    fetchStaffLivePresenceServer(sb, restaurantId),
    fetchStaffContractsForWageServer(sb, restaurantId),
  ]);

  if (staffResult.error) throw new Error(staffResult.error.message);

  const staff = (staffResult.data ?? []).map((r) =>
    mapStaffRow(r as Record<string, unknown>),
  );

  const todayEntries = await fetchStaffWorkEntriesTodayServer(
    sb,
    restaurantId,
    timeZone,
  );

  const dayYmd = restaurantTodayYmd(timeZone);
  const wageBreakdown = computeStaffDayWageBreakdown({
    entries: todayEntries,
    contracts,
    dayYmd,
    timeZone,
  });

  return {
    staff,
    presence,
    completedShifts: listCompletedDisplayShifts(todayEntries),
    wageBreakdown,
    summary: computeDashboardStaffSummary({
      staff,
      presence,
      todayEntries,
      dayYmd,
      timeZone,
    }),
  };
}
