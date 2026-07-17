import "server-only";

import {
  loadDisplayReservationRowById,
  loadDisplayReservationsDay,
} from "@/lib/display/display-reservations-server";
import { isValidReservationTimeRange } from "@/lib/display/display-reservation-save-times";
import {
  buildReservationLogChanges,
  buildReservationLogDetails,
  reservationSnapshotFromPayload,
} from "@/lib/reservations/reservation-log-build";
import { insertReservationLogEntry } from "@/lib/reservations/reservation-log-insert";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import { dispatchReservationEmail } from "@/lib/reservations/reservation-email-dispatch";
import { dispatchReservationWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { formatDiningTableLabel } from "@/lib/supabase/dining-floor-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatReservationGuestLabel } from "@/lib/types/reservation-log";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PosReservationDto = {
  id: string;
  reservationNumber: number;
  guestFirstName: string;
  guestLastName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  diningTableId: string | null;
  status: {
    id: string;
    code: string;
    name: string;
    colorHex: string;
  } | null;
  table: {
    id: string;
    tableNumber: number;
    tableName: string | null;
  } | null;
};

export type PosReservationsDayDto = {
  day: string;
  timezone: string;
  defaultDwellMinutes: number;
  bookingTimeStepMinutes: number;
  reservations: PosReservationDto[];
  statuses: Array<{
    id: string;
    code: string;
    name: string;
    colorHex: string;
  }>;
  tables: Array<{
    id: string;
    tableNumber: number;
    tableName: string | null;
    capacity: number;
    areaId: string | null;
  }>;
};

function mapDayPayload(
  raw: Exclude<Awaited<ReturnType<typeof loadDisplayReservationsDay>>, { error: string }>,
): PosReservationsDayDto {
  return {
    day: raw.day,
    timezone: raw.timezone,
    defaultDwellMinutes: raw.default_dwell_minutes,
    bookingTimeStepMinutes: raw.booking_time_step_minutes,
    reservations: raw.reservations.map((r) => ({
      id: r.id,
      reservationNumber: r.reservation_number,
      guestFirstName: r.guest_first_name,
      guestLastName: r.guest_last_name,
      guestPhone: r.guest_phone,
      guestEmail: r.guest_email,
      partySize: r.party_size,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      notes: r.notes,
      diningTableId: r.dining_table_id,
      status: r.status
        ? {
            id: r.status.id,
            code: r.status.code,
            name: r.status.name,
            colorHex: r.status.color_hex,
          }
        : null,
      table: r.table
        ? {
            id: r.table.id,
            tableNumber: r.table.table_number,
            tableName: r.table.table_name,
          }
        : null,
    })),
    statuses: (raw.statuses ?? []).map((s) => ({
      id: s.id as string,
      code: String(s.code ?? ""),
      name: String(s.name ?? ""),
      colorHex: String(s.color_hex ?? "#64748b"),
    })),
    tables: (raw.tables ?? []).map((t) => {
      const row = t as Record<string, unknown>;
      return {
        id: row.id as string,
        tableNumber: Number(row.table_number ?? 0),
        tableName: (row.table_name as string | null) ?? null,
        capacity: Number(row.capacity ?? 0),
        areaId: (row.area_id as string | null) ?? null,
      };
    }),
  };
}

export async function loadPosReservationsDay(
  restaurantId: string,
  dayYmd?: string | null,
): Promise<PosReservationsDayDto | { error: string }> {
  const data = await loadDisplayReservationsDay(restaurantId, dayYmd);
  if ("error" in data) {
    return { error: data.error ?? "load_failed" };
  }
  return mapDayPayload(data);
}

export async function createPosReservation(params: {
  restaurantId: string;
  profileId: string;
  guestFirstName?: string | null;
  guestLastName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  statusId?: string | null;
  diningTableId?: string | null;
  dwellMinutes?: number | null;
  notes?: string | null;
  notifyEmail?: boolean;
  notifyWhatsapp?: boolean;
}): Promise<
  | {
      ok: true;
      id: string;
      reservationNumber: number;
      guestPin: string;
      reservation: PosReservationDto | null;
    }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const family = normalizeReservationGuestLastName(params.guestLastName);
  if (!family) {
    return { ok: false, error: "last_name_required", status: 400 };
  }
  const given = normalizeReservationGuestFirstName(params.guestFirstName ?? "");

  if (
    !params.startsAt ||
    !params.endsAt ||
    !params.partySize ||
    params.partySize < 1 ||
    params.partySize > 50
  ) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const startDate = new Date(params.startsAt);
  const endDate = new Date(params.endsAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false, error: "invalid_starts_at", status: 400 };
  }
  if (!isValidReservationTimeRange(params.startsAt, params.endsAt)) {
    return { ok: false, error: "invalid_time_range", status: 400 };
  }

  const { data: settings } = await admin
    .from("restaurant_reservation_settings")
    .select("default_dwell_minutes")
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  const dwellMin =
    params.dwellMinutes && params.dwellMinutes >= 15
      ? params.dwellMinutes
      : (settings?.default_dwell_minutes ?? 120);

  let statusId = params.statusId?.trim() || null;
  if (!statusId) {
    const { data: confirmed } = await admin
      .from("reservation_statuses")
      .select("id")
      .eq("code", "confirmed")
      .maybeSingle();
    statusId = (confirmed?.id as string | undefined) ?? null;
  }
  if (!statusId) {
    return { ok: false, error: "status_missing", status: 500 };
  }

  const startsAt = startDate.toISOString();
  const endsAt = endDate.toISOString();
  const diningTableId = params.diningTableId?.trim() || null;
  const notes = params.notes?.trim() || null;
  const guestPhone = params.guestPhone?.trim() || null;
  const guestEmail = params.guestEmail?.trim() || null;
  const notifyEmail = params.notifyEmail === true;
  const notifyWhatsapp = params.notifyWhatsapp === true;

  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: params.restaurantId,
      guest_first_name: given,
      guest_last_name: family,
      guest_phone: guestPhone,
      guest_email: guestEmail,
      party_size: params.partySize,
      starts_at: startsAt,
      ends_at: endsAt,
      status_id: statusId,
      dining_table_id: diningTableId,
      dwell_minutes: dwellMin,
      notify_email: notifyEmail,
      notify_whatsapp: notifyWhatsapp,
      terms_accepted: true,
      notes,
      is_walk_in: false,
      created_by_profile_id: params.profileId,
    })
    .select("id, reservation_number, guest_pin")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "create_failed", status: 500 };
  }

  await writePosCreateLog(admin, {
    restaurantId: params.restaurantId,
    profileId: params.profileId,
    reservationId: data.id as string,
    reservationNumber: data.reservation_number as number,
    guestFirstName: given,
    guestLastName: family,
    partySize: params.partySize,
    startsAt,
    endsAt,
    statusId,
    diningTableId,
    dwellMinutes: dwellMin,
    notifyEmail,
    notifyWhatsapp,
    notes,
    guestPhone,
    guestEmail,
  });

  if (notifyWhatsapp) {
    void dispatchReservationWhatsapp(admin, data.id as string, "created").catch(
      () => undefined,
    );
  }
  if (notifyEmail) {
    void dispatchReservationEmail(admin, data.id as string, "created").catch(
      () => undefined,
    );
  }

  const row = await loadDisplayReservationRowById(
    params.restaurantId,
    data.id as string,
  );
  const reservation: PosReservationDto | null = row
    ? {
        id: row.id,
        reservationNumber: row.reservation_number,
        guestFirstName: row.guest_first_name,
        guestLastName: row.guest_last_name,
        guestPhone: row.guest_phone,
        guestEmail: row.guest_email,
        partySize: row.party_size,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        notes: row.notes,
        diningTableId: row.dining_table_id,
        status: row.status
          ? {
              id: row.status.id,
              code: row.status.code,
              name: row.status.name,
              colorHex: row.status.color_hex,
            }
          : null,
        table: row.table
          ? {
              id: row.table.id,
              tableNumber: row.table.table_number,
              tableName: row.table.table_name,
            }
          : null,
      }
    : null;

  return {
    ok: true,
    id: data.id as string,
    reservationNumber: data.reservation_number as number,
    guestPin: data.guest_pin as string,
    reservation,
  };
}

async function writePosCreateLog(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    profileId: string;
    reservationId: string;
    reservationNumber: number;
    guestFirstName: string;
    guestLastName: string;
    partySize: number;
    startsAt: string;
    endsAt: string;
    statusId: string;
    diningTableId: string | null;
    dwellMinutes: number;
    notifyEmail: boolean;
    notifyWhatsapp: boolean;
    notes: string | null;
    guestPhone: string | null;
    guestEmail: string | null;
  },
) {
  const { data: profile } = await admin
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", params.profileId)
    .maybeSingle();

  const { data: statusRow } = await admin
    .from("reservation_statuses")
    .select("name")
    .eq("id", params.statusId)
    .maybeSingle();

  let tableLabel = "Kein Tisch";
  if (params.diningTableId) {
    const { data: tableRow } = await admin
      .from("dining_tables")
      .select("table_number, table_name")
      .eq("id", params.diningTableId)
      .maybeSingle();
    if (tableRow) {
      tableLabel = formatDiningTableLabel({
        table_number: tableRow.table_number as number,
        table_name: (tableRow.table_name as string | null) ?? null,
      });
    }
  }

  const after = reservationSnapshotFromPayload(
    {
      guest_first_name: params.guestFirstName,
      guest_last_name: params.guestLastName,
      guest_phone: params.guestPhone,
      guest_email: params.guestEmail,
      party_size: params.partySize,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      status_id: params.statusId,
      dining_table_id: params.diningTableId,
      dwell_minutes: params.dwellMinutes,
      notify_email: params.notifyEmail,
      notify_whatsapp: params.notifyWhatsapp,
      terms_accepted: true,
      notes: params.notes,
    },
    (statusRow?.name as string | undefined) ?? "—",
    tableLabel,
  );

  await insertReservationLogEntry(admin, {
    restaurantId: params.restaurantId,
    reservationId: params.reservationId,
    actorUserId: params.profileId,
    action: "created",
    reservationNumber: params.reservationNumber,
    guestLabel: formatReservationGuestLabel(
      params.reservationNumber,
      params.guestFirstName,
      params.guestLastName,
    ),
    details: buildReservationLogDetails(buildReservationLogChanges(null, after), {
      actorSource: "staff",
      actorGivenName: ((profile?.given_name as string | null) ?? "").trim(),
      actorFamilyName: ((profile?.family_name as string | null) ?? "").trim(),
      summary: "Über POS angelegt",
    }),
  });
}
