import { allocationAmountCents, openLineQuantity } from "@gwada/pos-domain";
import {
  localDayBoundsIso,
  nextReservationAtTable,
  reservationsAtTableForInstant,
} from "@gwada/shared";
import { getStaffSupabase } from "@/src/lib/supabase";

const RESERVATION_STATUS_EMBED =
  "reservation_statuses!reservations_status_id_fkey";

export type DiningAreaRow = {
  id: string;
  name: string;
  display_number: number;
  color_hex: string;
  sort_order: number;
};

export type DiningTableRow = {
  id: string;
  area_id: string;
  table_number: number;
  table_name: string | null;
  capacity: number;
  is_active: boolean;
};

export type OpenTableSessionRow = {
  id: string;
  dining_table_id: string;
  cover_count: number;
  opened_at: string;
};

export type SessionFloorMeta = {
  orderCount: number;
  openCents: number;
};

export type TableReservationStatus = {
  code: string;
  name: string;
  color_hex: string;
};

export type TableReservationRow = {
  id: string;
  reservation_number: number;
  guest_first_name: string;
  guest_last_name: string;
  party_size: number;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  dining_table_id: string;
  status: TableReservationStatus | null;
};

export type TableReservationSlots = {
  current: TableReservationRow[];
  next: TableReservationRow | null;
};

export type DiningFloorSnapshot = {
  areas: DiningAreaRow[];
  tables: DiningTableRow[];
  openSessions: OpenTableSessionRow[];
  orderCountBySessionId: Record<string, number>;
  sessionMetaBySessionId: Record<string, SessionFloorMeta>;
  reservations: TableReservationRow[];
  reservationsByTableId: Record<string, TableReservationSlots>;
};

export function formatDiningTableLabel(
  table: Pick<DiningTableRow, "table_name" | "table_number">,
): string {
  const name = table.table_name?.trim();
  return name && name.length > 0 ? name : `Tisch ${table.table_number}`;
}

export function formatReservationGuestLabel(
  row: Pick<TableReservationRow, "guest_first_name" | "guest_last_name">,
): string {
  return `${row.guest_first_name} ${row.guest_last_name}`.trim();
}

function mapReservationRow(raw: Record<string, unknown>): TableReservationRow {
  const statusRaw =
    raw.reservation_statuses ??
    raw["reservation_statuses!reservations_status_id_fkey"];
  const statusOne = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  const status =
    statusOne && typeof statusOne === "object"
      ? {
          code: String((statusOne as { code: string }).code),
          name: String((statusOne as { name: string }).name),
          color_hex: String((statusOne as { color_hex: string }).color_hex),
        }
      : null;

  return {
    id: raw.id as string,
    reservation_number: Number(raw.reservation_number),
    guest_first_name: String(raw.guest_first_name ?? ""),
    guest_last_name: String(raw.guest_last_name ?? ""),
    party_size: Number(raw.party_size),
    starts_at: String(raw.starts_at),
    ends_at: String(raw.ends_at),
    notes: (raw.notes as string | null) ?? null,
    dining_table_id: String(raw.dining_table_id),
    status,
  };
}

function buildReservationsByTableId(
  tables: DiningTableRow[],
  reservations: TableReservationRow[],
  now: Date,
): Record<string, TableReservationSlots> {
  const occupancyOptions = { includeSeated: true as const };
  const currentByTable = reservationsAtTableForInstant(
    tables,
    reservations,
    now,
    occupancyOptions,
  );

  const out: Record<string, TableReservationSlots> = {};
  for (const table of tables) {
    const current = (currentByTable.get(table.id) ?? []) as TableReservationRow[];
    const currentIds = new Set(current.map((r) => r.id));
    let next = nextReservationAtTable(
      reservations,
      table.id,
      now,
      occupancyOptions,
    );
    if (next && currentIds.has(next.id)) {
      next = null;
    }
    out[table.id] = { current, next };
  }
  return out;
}

export async function fetchDiningFloorSnapshot(
  restaurantId: string,
): Promise<DiningFloorSnapshot> {
  const sb = getStaffSupabase();
  const { start, end } = localDayBoundsIso();

  const [areasRes, tablesRes, sessionsRes, reservationsRes] = await Promise.all([
    sb
      .from("dining_areas")
      .select("id, name, display_number, color_hex, sort_order")
      .eq("restaurant_id", restaurantId)
      .order("display_number", { ascending: true })
      .order("name", { ascending: true }),
    sb
      .from("dining_tables")
      .select("id, area_id, table_number, table_name, capacity, is_active")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("table_number"),
    sb
      .from("pos_table_sessions")
      .select("id, dining_table_id, cover_count, opened_at")
      .eq("restaurant_id", restaurantId)
      .eq("status", "open"),
    sb
      .from("reservations")
      .select(
        `
        id,
        reservation_number,
        guest_first_name,
        guest_last_name,
        party_size,
        starts_at,
        ends_at,
        notes,
        dining_table_id,
        ${RESERVATION_STATUS_EMBED} ( code, name, color_hex )
      `,
      )
      .eq("restaurant_id", restaurantId)
      .not("dining_table_id", "is", null)
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at"),
  ]);

  if (areasRes.error) throw new Error(areasRes.error.message);
  if (tablesRes.error) throw new Error(tablesRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (reservationsRes.error) throw new Error(reservationsRes.error.message);

  const tables = (tablesRes.data ?? []) as DiningTableRow[];
  const reservations = (reservationsRes.data ?? []).map((row) =>
    mapReservationRow(row as Record<string, unknown>),
  );
  const now = new Date();
  const reservationsByTableId = buildReservationsByTableId(
    tables,
    reservations,
    now,
  );

  const openSessions = (sessionsRes.data ?? []) as OpenTableSessionRow[];
  const sessionIds = openSessions.map((s) => s.id);

  const orderCountBySessionId: Record<string, number> = {};
  const sessionMetaBySessionId: Record<string, SessionFloorMeta> = {};

  for (const sid of sessionIds) {
    sessionMetaBySessionId[sid] = { orderCount: 0, openCents: 0 };
  }

  if (sessionIds.length > 0) {
    const { data: orders, error: ordersError } = await sb
      .from("pos_orders")
      .select("id, table_session_id")
      .in("table_session_id", sessionIds)
      .neq("status", "cancelled");

    if (ordersError) throw new Error(ordersError.message);

    const orderIds: string[] = [];
    const sessionIdByOrderId = new Map<string, string>();

    for (const row of orders ?? []) {
      const sid = row.table_session_id as string;
      const oid = row.id as string;
      orderIds.push(oid);
      sessionIdByOrderId.set(oid, sid);
      orderCountBySessionId[sid] = (orderCountBySessionId[sid] ?? 0) + 1;
      const meta = sessionMetaBySessionId[sid];
      if (meta) meta.orderCount += 1;
    }

    if (orderIds.length > 0) {
      type OrderLineRow = {
        order_id: string;
        quantity: number;
        paid_quantity: number | null;
        line_total_cents: number;
      };

      const { data: lineRows, error: linesError } = await sb
        .from("pos_order_lines")
        .select("order_id, quantity, paid_quantity, line_total_cents")
        .in("order_id", orderIds);

      if (linesError) throw new Error(linesError.message);

      for (const line of (lineRows ?? []) as unknown as OrderLineRow[]) {
        const sid = sessionIdByOrderId.get(line.order_id as string);
        if (!sid) continue;
        const meta = sessionMetaBySessionId[sid];
        if (!meta) continue;

        const openQty = openLineQuantity(
          Number(line.quantity),
          Number(line.paid_quantity ?? 0),
        );
        if (openQty <= 0) continue;

        meta.openCents += allocationAmountCents(
          Number(line.line_total_cents),
          Number(line.quantity),
          openQty,
        );
      }
    }
  }

  return {
    areas: (areasRes.data ?? []) as DiningAreaRow[],
    tables,
    openSessions,
    orderCountBySessionId,
    sessionMetaBySessionId,
    reservations,
    reservationsByTableId,
  };
}
