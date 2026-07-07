import "server-only";

import { localDayBoundsIso } from "@gwada/shared";
import { defaultWeeklyHours, WEEKDAY_ORDER } from "@/lib/constants/restaurant-profile";
import { normalizeBookingTimeStepMinutes } from "@/lib/reservations/booking-time-step";
import {
  parseReservationPendingChange,
  type ReservationPendingChange,
} from "@/lib/reservations/reservation-pending-change";
import { UNCONFIRMED_RESERVATION_STATUS_CODES } from "@/lib/reservations/unconfirmed-reservations";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import type { DateHoursException, DayHours, Weekday } from "@/lib/types/restaurant";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function timeToHHmm(t: string | null | undefined): string | undefined {
  if (!t) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return undefined;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

async function loadOpeningHoursAdmin(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{
  weeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
}> {
  const weeklyHours = defaultWeeklyHours() as Record<Weekday, DayHours>;
  const dateExceptions: DateHoursException[] = [];

  const { data } = await admin
    .from("opening_hours")
    .select(
      "id, kind, weekday, exception_date, closed, opens_at, closes_at, note",
    )
    .eq("restaurant_id", restaurantId);

  for (const raw of data ?? []) {
    if (raw.kind === "weekly" && raw.weekday) {
      weeklyHours[raw.weekday as Weekday] = {
        closed: raw.closed as boolean,
        open: raw.closed ? undefined : timeToHHmm(raw.opens_at as string),
        close: raw.closed ? undefined : timeToHHmm(raw.closes_at as string),
      };
    } else if (raw.kind === "exception" && raw.exception_date) {
      dateExceptions.push({
        id: raw.id as string,
        date: String(raw.exception_date).slice(0, 10),
        closed: raw.closed as boolean,
        open: raw.closed ? undefined : timeToHHmm(raw.opens_at as string),
        close: raw.closed ? undefined : timeToHHmm(raw.closes_at as string),
        note: (raw.note as string | null) ?? undefined,
      });
    }
  }

  return { weeklyHours, dateExceptions };
}

export type DisplayReservationRow = {
  id: string;
  reservation_number: number;
  contact_id: string | null;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  dining_table_id: string | null;
  status: {
    id: string;
    code: string;
    name: string;
    color_hex: string;
  } | null;
  table: {
    id: string;
    table_number: number;
    table_name: string | null;
  } | null;
  pending_change: ReservationPendingChange | null;
  status_before_change_id: string | null;
};

export type DisplayReservationDetail = DisplayReservationRow & {
  restaurant_id: string;
  guest_pin: string;
  notify_email: boolean;
  notify_whatsapp: boolean;
  dwell_minutes: number | null;
  terms_accepted: boolean;
  created_at: string;
};

function readReservationStatusEmbed(row: Record<string, unknown>) {
  const statusRaw =
    row.reservation_statuses ??
    row["reservation_statuses!reservations_status_id_fkey"];
  return Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
}

function mapReservationRow(row: Record<string, unknown>): DisplayReservationRow {
  const statusOne = readReservationStatusEmbed(row);
  const tableRaw = row.dining_tables;
  const tableOne = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw;
  return {
    id: row.id as string,
    reservation_number: row.reservation_number as number,
    contact_id: (row.contact_id as string | null) ?? null,
    guest_first_name: row.guest_first_name as string,
    guest_last_name: row.guest_last_name as string,
    guest_phone: (row.guest_phone as string | null) ?? null,
    guest_email: (row.guest_email as string | null) ?? null,
    party_size: row.party_size as number,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    notes: (row.notes as string | null) ?? null,
    dining_table_id: (row.dining_table_id as string | null) ?? null,
    status: statusOne
      ? {
          id: (statusOne as { id: string }).id,
          code: (statusOne as { code: string }).code,
          name: (statusOne as { name: string }).name,
          color_hex: (statusOne as { color_hex: string }).color_hex,
        }
      : null,
    table: tableOne
      ? {
          id: (tableOne as { id: string }).id,
          table_number: (tableOne as { table_number: number }).table_number,
          table_name: (tableOne as { table_name: string | null }).table_name,
        }
      : null,
    pending_change: parseReservationPendingChange(row.pending_change),
    status_before_change_id:
      (row.status_before_change_id as string | null) ?? null,
  };
}

export async function loadDisplayReservationsDay(
  restaurantId: string,
  dayYmd?: string | null,
) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" as const };

  const { start, end, day } = localDayBoundsIso(dayYmd);

  const [
    { data: reservationRows, error: resError },
    { data: statuses },
    { data: areas },
    { data: tables },
    { data: settings },
    hoursBundle,
    { data: restaurantRow },
    { data: maxReservationRow },
    openBundle,
  ] = await Promise.all([
    admin
      .from("reservations")
      .select(
        `
        id,
        reservation_number,
        contact_id,
        guest_first_name,
        guest_last_name,
        guest_phone,
        guest_email,
        party_size,
        starts_at,
        ends_at,
        notes,
        status_id,
        dining_table_id,
        pending_change,
        ${RESERVATION_STATUS_EMBED} ( id, code, name, color_hex ),
        dining_tables ( id, table_number, table_name )
      `,
      )
      .eq("restaurant_id", restaurantId)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at", { ascending: true }),
    admin
      .from("reservation_statuses")
      .select("id, code, name, color_hex")
      .order("sort_order"),
    admin
      .from("dining_areas")
      .select("id, restaurant_id, name, sort_order, display_number, color_hex")
      .eq("restaurant_id", restaurantId)
      .order("display_number"),
    admin
      .from("dining_tables")
      .select(
        "id, restaurant_id, area_id, table_number, table_name, capacity, sort_order, is_active, plan_x_pct, plan_y_pct, plan_w_pct, plan_h_pct, color_hex, floor",
      )
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("table_number"),
    admin
      .from("restaurant_reservation_settings")
      .select(
        "default_dwell_minutes, booking_time_step_minutes, min_minutes_before_closing",
      )
      .eq("restaurant_id", restaurantId)
      .maybeSingle(),
    loadOpeningHoursAdmin(admin, restaurantId),
    admin
      .from("restaurants")
      .select("name")
      .eq("id", restaurantId)
      .maybeSingle(),
    admin
      .from("reservations")
      .select("reservation_number")
      .eq("restaurant_id", restaurantId)
      .order("reservation_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadDisplayOpenReservations(restaurantId),
  ]);

  if (resError) {
    return { error: resError.message };
  }

  if ("error" in openBundle && openBundle.error) {
    return { error: openBundle.error };
  }

  const openCount =
    "count" in openBundle ? openBundle.count : 0;

  const reservations = (reservationRows ?? []).map((r) =>
    mapReservationRow(r as Record<string, unknown>),
  );

  const guestCount = reservations.reduce((s, r) => s + r.party_size, 0);

  return {
    day,
    reservations,
    statuses: statuses ?? [],
    areas: areas ?? [],
    tables: tables ?? [],
    default_dwell_minutes: settings?.default_dwell_minutes ?? 120,
    booking_time_step_minutes: normalizeBookingTimeStepMinutes(
      settings?.booking_time_step_minutes,
    ),
    min_minutes_before_closing:
      typeof settings?.min_minutes_before_closing === "number"
        ? settings.min_minutes_before_closing
        : 60,
    restaurant_name: (restaurantRow?.name as string | undefined) ?? null,
    restaurant_id: restaurantId,
    next_reservation_number:
      ((maxReservationRow?.reservation_number as number | undefined) ?? 0) + 1,
    weekly_hours: hoursBundle.weeklyHours,
    date_exceptions: hoursBundle.dateExceptions,
    stats: {
      count: reservations.length,
      guests: guestCount,
    },
    open_count: openCount,
  };
}

export async function loadDisplayReservationDetail(
  restaurantId: string,
  reservationId: string,
): Promise<
  { detail: DisplayReservationDetail } | { error: string }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };

  const { data, error } = await admin
    .from("reservations")
    .select(
      `
        id,
        restaurant_id,
        reservation_number,
        contact_id,
        guest_first_name,
        guest_last_name,
        guest_phone,
        guest_email,
        guest_pin,
        party_size,
        starts_at,
        ends_at,
        notes,
        status_id,
        dining_table_id,
        dwell_minutes,
        notify_email,
        notify_whatsapp,
        terms_accepted,
        created_at,
        pending_change,
        ${RESERVATION_STATUS_EMBED} ( id, code, name, color_hex ),
        dining_tables ( id, table_number, table_name )
      `,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data || data.restaurant_id !== restaurantId) {
    return { error: "not_found" };
  }

  const mapped = mapReservationRow(data as Record<string, unknown>);
  return {
    detail: {
      ...mapped,
      restaurant_id: data.restaurant_id as string,
      guest_pin: data.guest_pin as string,
      notify_email: Boolean(data.notify_email),
      notify_whatsapp: Boolean(data.notify_whatsapp),
      dwell_minutes: (data.dwell_minutes as number | null) ?? null,
      terms_accepted: Boolean(data.terms_accepted),
      created_at: data.created_at as string,
    },
  };
}

/** Letzter Insert + Display-Zeile für Live-Polling (Service-Role). */
export async function loadDisplayReservationsLiveSnapshot(
  restaurantId: string,
): Promise<{
  revision: string;
  latestCreatedAt: string | null;
  latestUpdatedAt: string | null;
  latest: DisplayReservationRow | null;
}> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      revision: "",
      latestCreatedAt: null,
      latestUpdatedAt: null,
      latest: null,
    };
  }

  const { fetchReservationsLiveSignal } = await import(
    "@/lib/reservations/reservations-live-signal"
  );
  const { fetchTableLatestUpdatedAt, composeDisplayLiveRevision } = await import(
    "@/lib/display/display-module-live-revision"
  );

  const [signal, latestUpdatedAt] = await Promise.all([
    fetchReservationsLiveSignal(admin, restaurantId),
    fetchTableLatestUpdatedAt(admin, "reservations", restaurantId),
  ]);

  const latestCreatedAt = signal.latestCreatedAt;
  const revision = composeDisplayLiveRevision([
    latestCreatedAt,
    latestUpdatedAt,
  ]);

  if (!latestCreatedAt) {
    return {
      revision,
      latestCreatedAt: null,
      latestUpdatedAt,
      latest: null,
    };
  }

  const { data, error } = await admin
    .from("reservations")
    .select(
      `
        id,
        reservation_number,
        contact_id,
        guest_first_name,
        guest_last_name,
        guest_phone,
        guest_email,
        party_size,
        starts_at,
        ends_at,
        notes,
        status_id,
        dining_table_id,
        created_at,
        ${RESERVATION_STATUS_EMBED} ( id, code, name, color_hex ),
        dining_tables ( id, table_number, table_name )
      `,
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      revision,
      latestCreatedAt,
      latestUpdatedAt,
      latest: null,
    };
  }

  return {
    revision,
    latestCreatedAt,
    latestUpdatedAt,
    latest: mapReservationRow(data as Record<string, unknown>),
  };
}

/** @deprecated Alias — nutze {@link loadDisplayReservationsLiveSnapshot}. */
export async function loadDisplayReservationsLiveSignal(
  restaurantId: string,
): Promise<{ latestCreatedAt: string | null }> {
  const snapshot = await loadDisplayReservationsLiveSnapshot(restaurantId);
  return { latestCreatedAt: snapshot.latestCreatedAt };
}

export async function loadDisplayReservationRowById(
  restaurantId: string,
  reservationId: string,
): Promise<DisplayReservationRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("reservations")
    .select(
      `
        id,
        reservation_number,
        contact_id,
        guest_first_name,
        guest_last_name,
        guest_phone,
        guest_email,
        party_size,
        starts_at,
        ends_at,
        notes,
        status_id,
        dining_table_id,
        pending_change,
        ${RESERVATION_STATUS_EMBED} ( id, code, name, color_hex ),
        dining_tables ( id, table_number, table_name )
      `,
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !data) return null;
  return mapReservationRow(data as Record<string, unknown>);
}

/** Unbestätigte + Änderungsanfragen (alle Tage). */
export async function loadDisplayOpenReservations(restaurantId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" as const };

  const { data: statuses, error: statusError } = await admin
    .from("reservation_statuses")
    .select("id, code")
    .in("code", [...UNCONFIRMED_RESERVATION_STATUS_CODES]);

  if (statusError) return { error: statusError.message };

  const statusIds = (statuses ?? []).map((s) => s.id as string);
  if (statusIds.length === 0) {
    return { reservations: [] as DisplayReservationRow[], count: 0 };
  }

  const { data: rows, error } = await admin
    .from("reservations")
    .select(
      `
        id,
        reservation_number,
        contact_id,
        guest_first_name,
        guest_last_name,
        guest_phone,
        guest_email,
        party_size,
        starts_at,
        ends_at,
        notes,
        status_id,
        dining_table_id,
        pending_change,
        status_before_change_id,
        ${RESERVATION_STATUS_EMBED} ( id, code, name, color_hex ),
        dining_tables ( id, table_number, table_name )
      `,
    )
    .eq("restaurant_id", restaurantId)
    .in("status_id", statusIds)
    .order("starts_at", { ascending: true });

  if (error) return { error: error.message };

  const reservations = (rows ?? []).map((r) =>
    mapReservationRow(r as Record<string, unknown>),
  );

  return { reservations, count: reservations.length };
}

export { WEEKDAY_ORDER };
