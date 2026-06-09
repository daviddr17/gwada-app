import { UNCONFIRMED_RESERVATION_STATUS_CODES } from "@gwada/shared";
import { getStaffSupabase } from "@/src/lib/supabase";

const RESERVATION_STATUS_EMBED =
  "reservation_statuses!reservations_status_id_fkey";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export type ReservationStatusJoin = {
  id: string;
  code: string;
  name: string;
  color_hex: string;
};

export type ReservationDiningTableJoin = {
  id: string;
  table_number: number;
  table_name: string | null;
  area_id: string;
};

export type ReservationListRow = {
  id: string;
  restaurant_id: string;
  reservation_number: number;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  dining_table_id: string | null;
  notes: string | null;
  reservation_statuses: ReservationStatusJoin | null;
  dining_tables: ReservationDiningTableJoin | null;
};

function normalizeDiningTableJoin(raw: unknown): ReservationDiningTableJoin | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") return null;

  const tn = o.table_number;
  const hasNumber =
    (typeof tn === "number" && Number.isFinite(tn)) ||
    (typeof tn === "string" &&
      tn.trim() !== "" &&
      !Number.isNaN(Number.parseInt(tn, 10)));

  const areaRaw = o.area_id;
  const areaId =
    typeof areaRaw === "string" && areaRaw.length > 0 ? areaRaw : "";

  if (hasNumber) {
    const tableNumber =
      typeof tn === "number" ? tn : Number.parseInt(String(tn), 10);
    const nameRaw = o.table_name;
    const tableName =
      nameRaw == null ? null : String(nameRaw).trim() || null;
    return {
      id: o.id,
      table_number: tableNumber,
      table_name: tableName,
      area_id: areaId,
    };
  }

  const labelRaw = o.label;
  const label = labelRaw == null ? "" : String(labelRaw).trim();
  return {
    id: o.id,
    table_number: 1,
    table_name: label.length > 0 ? label : null,
    area_id: areaId,
  };
}

export function mapRawToReservationListRow(
  row: Record<string, unknown>,
): ReservationListRow {
  const st = row.reservation_statuses;
  const status = Array.isArray(st) ? (st[0] ?? null) : st;
  const dt = row.dining_tables;
  const tableRaw = Array.isArray(dt) ? (dt[0] ?? null) : dt;

  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    reservation_number: Number(row.reservation_number),
    guest_first_name: String(row.guest_first_name ?? ""),
    guest_last_name: String(row.guest_last_name ?? ""),
    guest_phone:
      row.guest_phone == null ? null : String(row.guest_phone),
    guest_email:
      row.guest_email == null ? null : String(row.guest_email),
    party_size: Number(row.party_size),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
    dining_table_id:
      row.dining_table_id == null ? null : String(row.dining_table_id),
    notes: row.notes == null ? null : String(row.notes),
    reservation_statuses: status as ReservationStatusJoin | null,
    dining_tables: normalizeDiningTableJoin(tableRaw),
  };
}

const RESERVATION_LIST_ROW_SELECT = `
  id,
  restaurant_id,
  reservation_number,
  guest_first_name,
  guest_last_name,
  guest_phone,
  guest_email,
  party_size,
  starts_at,
  ends_at,
  dining_table_id,
  notes,
  ${RESERVATION_STATUS_EMBED} ( id, code, name, color_hex ),
  dining_tables ( * )
`;

export async function fetchReservationsForMonth(params: {
  restaurantId: string;
  rangeStartIso: string;
  rangeEndExclusiveIso: string;
}): Promise<ReservationListRow[]> {
  if (!isUuid(params.restaurantId)) return [];

  const sb = getStaffSupabase();
  const { data, error } = await sb
    .from("reservations")
    .select(RESERVATION_LIST_ROW_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .gte("starts_at", params.rangeStartIso)
    .lt("starts_at", params.rangeEndExclusiveIso)
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapRawToReservationListRow(row as Record<string, unknown>),
  );
}

export async function fetchUnconfirmedReservations(
  restaurantId: string,
): Promise<ReservationListRow[]> {
  if (!isUuid(restaurantId)) return [];

  const sb = getStaffSupabase();
  const { data: statuses, error: statusError } = await sb
    .from("reservation_statuses")
    .select("id, code")
    .order("sort_order", { ascending: true });

  if (statusError) throw new Error(statusError.message);

  const statusIds = (statuses ?? [])
    .filter((s) =>
      (UNCONFIRMED_RESERVATION_STATUS_CODES as readonly string[]).includes(
        String(s.code),
      ),
    )
    .map((s) => String(s.id));

  if (statusIds.length === 0) return [];

  const { data, error } = await sb
    .from("reservations")
    .select(RESERVATION_LIST_ROW_SELECT)
    .eq("restaurant_id", restaurantId)
    .in("status_id", statusIds)
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) =>
    mapRawToReservationListRow(row as Record<string, unknown>),
  );
}

export async function fetchReservationById(params: {
  restaurantId: string;
  id: string;
}): Promise<ReservationListRow | null> {
  if (!isUuid(params.restaurantId) || !isUuid(params.id)) return null;

  const sb = getStaffSupabase();
  const { data, error } = await sb
    .from("reservations")
    .select(RESERVATION_LIST_ROW_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRawToReservationListRow(data as Record<string, unknown>);
}
