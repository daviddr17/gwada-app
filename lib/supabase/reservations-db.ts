import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";

export function reservationsDbEnabled(): boolean {
  return workspacePersistenceConfigured();
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
  /** Leer bis Migration `dining_areas_floor_plan` (legacy `label`-Schema). */
  area_id: string;
};

/**
 * Normalisiert den eingebetteten `dining_tables`-Join: Remote kann noch das alte
 * Schema (`label` ohne `table_number`) haben; PostgREST würde bei festem Spaltenliste-Fehler scheitern,
 * deshalb wird mit `*` geladen und hier vereinheitlicht.
 */
export function normalizeReservationDiningTableJoin(
  raw: unknown,
): ReservationDiningTableJoin | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string") return null;

  const tn = o.table_number;
  const hasNewNumber =
    (typeof tn === "number" && Number.isFinite(tn)) ||
    (typeof tn === "string" &&
      tn.trim() !== "" &&
      !Number.isNaN(Number.parseInt(tn, 10)));

  const areaRaw = o.area_id;
  const areaId =
    typeof areaRaw === "string" && areaRaw.length > 0 ? areaRaw : "";

  if (hasNewNumber) {
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
  dwell_minutes: number | null;
  dining_table_id: string | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  reservation_statuses: ReservationStatusJoin | null;
  dining_tables: ReservationDiningTableJoin | null;
};

function mapRawToReservationListRow(
  row: Record<string, unknown>,
): ReservationListRow {
  const st = row.reservation_statuses;
  const status = Array.isArray(st) ? (st[0] ?? null) : st;
  const dt = row.dining_tables;
  const tableRaw = Array.isArray(dt) ? (dt[0] ?? null) : dt;
  return {
    ...(row as Omit<
      ReservationListRow,
      "reservation_statuses" | "dining_tables"
    >),
    reservation_statuses: status as ReservationStatusJoin | null,
    dining_tables: normalizeReservationDiningTableJoin(tableRaw),
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
      dwell_minutes,
      dining_table_id,
      notify_email,
      notify_whatsapp,
      terms_accepted,
      reservation_statuses ( id, code, name, color_hex ),
      dining_tables ( * )
    `;

export async function fetchReservationsForRestaurant(params: {
  restaurantId: string;
  rangeStartIso: string;
  rangeEndExclusiveIso: string;
}): Promise<{ data: ReservationListRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("reservations")
    .select(RESERVATION_LIST_ROW_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .gte("starts_at", params.rangeStartIso)
    .lt("starts_at", params.rangeEndExclusiveIso)
    .order("starts_at", { ascending: true });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }
  const raw = (data ?? []) as Record<string, unknown>[];
  const normalized: ReservationListRow[] = raw.map((row) =>
    mapRawToReservationListRow(row),
  );
  return { data: normalized, error: null };
}

export async function fetchReservationById(params: {
  restaurantId: string;
  id: string;
}): Promise<{ data: ReservationListRow | null; error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId) || !isUuidRestaurantId(params.id)) {
    return { data: null, error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("reservations")
    .select(RESERVATION_LIST_ROW_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }
  if (!data) {
    return { data: null, error: null };
  }
  return {
    data: mapRawToReservationListRow(data as Record<string, unknown>),
    error: null,
  };
}

export async function fetchReservationStatuses(): Promise<{
  data: ReservationStatusJoin[];
  error: Error | null;
}> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("reservation_statuses")
    .select("id, code, name, color_hex")
    .order("sort_order", { ascending: true });
  if (error) {
    return { data: [], error: new Error(error.message) };
  }
  return { data: (data ?? []) as ReservationStatusJoin[], error: null };
}

export type ReservationUpdatePayload = {
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status_id: string;
  dining_table_id: string | null;
  dwell_minutes: number | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
};

export type ReservationInsertPayload = ReservationUpdatePayload & {
  restaurant_id: string;
};

export async function insertReservation(
  payload: ReservationInsertPayload,
): Promise<{ error: Error | null }> {
  if (!isUuidRestaurantId(payload.restaurant_id)) {
    return { error: new Error("Ungültige Restaurant-ID.") };
  }
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("reservations").insert({
    restaurant_id: payload.restaurant_id,
    guest_first_name: payload.guest_first_name,
    guest_last_name: payload.guest_last_name,
    guest_phone: payload.guest_phone,
    guest_email: payload.guest_email,
    party_size: payload.party_size,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    status_id: payload.status_id,
    dining_table_id: payload.dining_table_id,
    dwell_minutes: payload.dwell_minutes,
    notify_email: payload.notify_email,
    notify_whatsapp: payload.notify_whatsapp,
    terms_accepted: payload.terms_accepted,
  });
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function updateReservation(
  id: string,
  patch: ReservationUpdatePayload,
): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("reservations").update(patch).eq("id", id);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function deleteReservation(params: {
  restaurantId: string;
  id: string;
}): Promise<{ error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId) || !isUuidRestaurantId(params.id)) {
    return { error: new Error("Ungültige ID.") };
  }
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("reservations")
    .delete()
    .eq("id", params.id)
    .eq("restaurant_id", params.restaurantId);
  if (error) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}
