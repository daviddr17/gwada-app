import { purchaseOrderStatusLabel } from "@/lib/inventory/purchase-order-status";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { restaurantIsoToYmdHm } from "@/lib/restaurant/restaurant-timezone";
import { formatStaffContractLogSummary } from "@/lib/staff/staff-contract-log";
import { formatStaffWorkEntryLogDisplaySummary } from "@/lib/staff/staff-work-entry-log";
import {
  accountingDocumentLogActionLabel,
  type AccountingDocumentLogAction,
  type AccountingDocumentLogDetails,
  type AccountingDocumentLogKind,
} from "@/lib/types/accounting-document-log";
import {
  documentLogActionLabel,
  type DocumentLogAction,
} from "@/lib/types/document-log";
import {
  formatReservationLogDetailsSummary,
  reservationLogActionLabel,
  type ReservationLogAction,
  type ReservationLogDetails,
} from "@/lib/types/reservation-log";
import {
  STAFF_WORK_ENTRY_LABELS,
  type StaffAuditLogChange,
  type StaffContractLogAction,
  type StaffWorkEntryType,
} from "@/lib/types/staff";
import { COMPLIANCE_LOG_ACTION_LABELS } from "@/lib/types/compliance";
import { STAFF_TODO_LOG_ACTION_LABELS } from "@/lib/types/staff-todos";

export type StaffActivityItem = {
  id: string;
  at: string;
  area: string;
  title: string;
  detail: string;
};

const PER_SOURCE = 20;
export const STAFF_ACTIVITY_LIMIT = 40;

function dayLabel(iso: string): string {
  const { ymd } = restaurantIsoToYmdHm(iso);
  const [, month, day] = ymd.split("-");
  if (!day || !month) return ymd;
  return `${day}.${month}.`;
}

function hmLabel(iso: string): string {
  return restaurantIsoToYmdHm(iso).hm;
}

function rangeLabel(fromIso: string, toIso: string, open: boolean): string {
  const day = dayLabel(fromIso);
  if (open) return `${day} · seit ${hmLabel(fromIso)}`;
  return `${day} · ${hmLabel(fromIso)}–${hmLabel(toIso)}`;
}

function entryTypeLabel(type: string | null | undefined): string {
  if (type && type in STAFF_WORK_ENTRY_LABELS) {
    return STAFF_WORK_ENTRY_LABELS[type as StaffWorkEntryType];
  }
  return "Eintrag";
}

export function staffActivityFromWorkEntry(row: {
  id: string;
  entry_type: string;
  starts_at: string;
  ends_at: string;
  is_open?: boolean | null;
  note?: string | null;
}): StaffActivityItem {
  const open = row.is_open === true;
  const display = row.note?.trim() === "Display";
  const span = rangeLabel(row.starts_at, row.ends_at, open);
  return {
    id: `work:${row.id}`,
    at: row.starts_at,
    area: "Arbeitszeit",
    title: entryTypeLabel(row.entry_type),
    detail: display ? `${span} · am Display` : span,
  };
}

export function staffActivityFromTimeRequest(row: {
  id: string;
  entry_type: string | null;
  status: string;
  requested_starts_at: string;
  requested_ends_at: string | null;
  created_at: string;
}): StaffActivityItem {
  const status =
    row.status === "approved"
      ? "freigegeben"
      : row.status === "declined"
        ? "abgelehnt"
        : "angefragt";
  const range = row.requested_ends_at
    ? `${hmLabel(row.requested_starts_at)}–${hmLabel(row.requested_ends_at)}`
    : hmLabel(row.requested_starts_at);
  return {
    id: `time-request:${row.id}`,
    at: row.created_at,
    area: "Arbeitszeit",
    title: "Zeit nachtragen",
    detail: `${entryTypeLabel(row.entry_type)} · ${dayLabel(row.requested_starts_at)} · ${range} · ${status}`,
  };
}

export function staffActivityFromTodoLog(row: {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, unknown> | null;
}): StaffActivityItem {
  const labels = STAFF_TODO_LOG_ACTION_LABELS as Record<string, string>;
  const title = labels[row.action] ?? "Aufgabe";
  const todoTitle =
    typeof row.details?.title === "string" && row.details.title.trim()
      ? row.details.title.trim()
      : null;
  const reason =
    typeof row.details?.reason === "string" && row.details.reason.trim()
      ? row.details.reason.trim()
      : null;
  const detail = [todoTitle, reason].filter(Boolean).join(" · ") || title;
  return {
    id: `todo:${row.id}`,
    at: row.created_at,
    area: "Checkliste",
    title,
    detail,
  };
}

export function mergeStaffActivityItems(
  items: StaffActivityItem[],
  limit = STAFF_ACTIVITY_LIMIT,
): StaffActivityItem[] {
  const byId = new Map<string, StaffActivityItem>();
  for (const item of items) byId.set(item.id, item);
  return [...byId.values()]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/** Arbeitszeit nicht die ganze Liste füllen lassen — Dashboard-Aktionen bleiben sichtbar. */
export function composeStaffActivityTimeline(
  items: StaffActivityItem[],
): StaffActivityItem[] {
  const time = items.filter((item) => item.area === "Arbeitszeit");
  const dashboard = items.filter((item) => item.area !== "Arbeitszeit");
  if (dashboard.length === 0) return mergeStaffActivityItems(time);
  const dashboardKept = mergeStaffActivityItems(
    dashboard,
    Math.ceil(STAFF_ACTIVITY_LIMIT / 2),
  );
  const timeKept = mergeStaffActivityItems(
    time,
    STAFF_ACTIVITY_LIMIT - dashboardKept.length,
  );
  return mergeStaffActivityItems(
    [...timeKept, ...dashboardKept],
    STAFF_ACTIVITY_LIMIT,
  );
}

function protocolName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("de-DE") : "";
}

export function protocolActorMatchesStaff(
  entry: Record<string, unknown>,
  givenName: string,
  familyName: string,
): boolean {
  const given = givenName.trim().toLocaleLowerCase("de-DE");
  const family = familyName.trim().toLocaleLowerCase("de-DE");
  const full = `${given} ${family}`.trim();
  if (!full) return false;
  const first = protocolName(entry.userFirstName);
  const last = protocolName(entry.userLastName);
  if (first && last && first === given && last === family) return true;
  const legacy = protocolName(entry.userName);
  return legacy === full;
}

function qtyUnitLabel(qty: number, unitLabel: string): string {
  const unit = unitLabel.trim();
  const amount = Number.isInteger(qty) ? String(qty) : String(qty).replace(".", ",");
  return unit ? `${amount} ${unit}` : amount;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stockKindTitle(kind: string | null): string {
  switch (kind) {
    case "manual_stock":
      return "Bestand geändert";
    case "stock_from_delivery":
      return "Lieferung im Bestand";
    case "stock_delivery_reverted":
      return "Lieferung zurück";
    case "stock_from_invoice":
      return "Bestand · Rechnung";
    case "stock_from_invoice_correction":
      return "Bestand · Korrektur";
    case "stock_from_pos_order":
      return "Bestand · POS";
    case "stock_from_pos_void":
      return "Bestand · Storno";
    default:
      return "Bestand";
  }
}

export function staffActivityFromStockLog(row: {
  id: string;
  ingredientName?: string | null;
  entry: Record<string, unknown>;
}): StaffActivityItem | null {
  const at = text(row.entry.at);
  if (!at) return null;
  const kind = text(row.entry.kind);
  const name = row.ingredientName?.trim() || text(row.entry.ingredientName);
  const unit = text(row.entry.unitLabel) ?? "";
  const from = num(row.entry.fromQuantity);
  const to = num(row.entry.toQuantity);
  const detail =
    name && from != null && to != null
      ? `„${name}“ · ${qtyUnitLabel(from, unit)} → ${qtyUnitLabel(to, unit)}`
      : name
        ? `„${name}“`
        : stockKindTitle(kind);
  return {
    id: `stock:${row.id}`,
    at,
    area: "Bestand",
    title: stockKindTitle(kind),
    detail,
  };
}

function orderStatusLabel(status: string): string {
  if (status === "open" || status === "ordered" || status === "closed") {
    return purchaseOrderStatusLabel(status);
  }
  return status;
}

export function staffActivityFromPurchaseOrderLog(row: {
  id: string;
  entry: Record<string, unknown>;
}): StaffActivityItem | null {
  const at = text(row.entry.at);
  if (!at) return null;
  const kind = text(row.entry.kind);
  const name = text(row.entry.ingredientName);
  const unit = text(row.entry.unitLabel) ?? "";
  let title = "Bestellung";
  let detail = name ? `„${name}“` : "Bestellung";
  if (kind === "add_to_order") {
    title = "Zur Bestellung";
    const qty = num(row.entry.quantity);
    if (name && qty != null) detail = `„${name}“ · ${qtyUnitLabel(qty, unit)}`;
  } else if (kind === "quantity_change") {
    title = "Bestellmenge";
    const from = num(row.entry.fromQuantity);
    const to = num(row.entry.toQuantity);
    if (name && from != null && to != null) {
      detail =
        to === 0
          ? `„${name}“ entfernt`
          : `„${name}“ · ${qtyUnitLabel(from, unit)} → ${qtyUnitLabel(to, unit)}`;
    }
  } else if (kind === "status_change") {
    title = "Bestellstatus";
    const from = text(row.entry.fromStatus);
    const to = text(row.entry.toStatus);
    if (from && to) detail = `${orderStatusLabel(from)} → ${orderStatusLabel(to)}`;
  } else if (kind === "marked_delivered") {
    title = "Lieferung erfasst";
  } else if (kind === "delivery_reverted") {
    title = "Lieferung zurück";
  } else if (kind === "legacy_adjustment") {
    title = "Bestellung angepasst";
  }
  return {
    id: `po:${row.id}`,
    at,
    area: "Bestellung",
    title,
    detail,
  };
}

export function staffActivityFromComplianceLog(row: {
  id: string;
  action: string;
  created_at: string;
  details: Record<string, unknown> | null;
}): StaffActivityItem {
  const labels = COMPLIANCE_LOG_ACTION_LABELS as Record<string, string>;
  const title = labels[row.action] ?? "Checkliste";
  const name =
    typeof row.details?.name === "string" && row.details.name.trim()
      ? row.details.name.trim()
      : null;
  return {
    id: `compliance:${row.id}`,
    at: row.created_at,
    area: "Checkliste",
    title,
    detail: name || title,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

async function rowsOf<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function loadStaffActivityTimeline(params: {
  restaurantId: string;
  staffId: string;
  profileId: string | null;
}): Promise<StaffActivityItem[]> {
  const supabase = createSupabaseBrowserClient();
  const { restaurantId, staffId, profileId } = params;

  const workPromise = rowsOf(
    supabase
      .from("restaurant_staff_work_entries")
      .select("id, entry_type, starts_at, ends_at, is_open, note")
      .eq("restaurant_id", restaurantId)
      .eq("staff_id", staffId)
      .order("starts_at", { ascending: false })
      .limit(PER_SOURCE),
  );

  const requestPromise = rowsOf(
    supabase
      .from("restaurant_staff_display_time_requests")
      .select(
        "id, entry_type, status, requested_starts_at, requested_ends_at, created_at",
      )
      .eq("restaurant_id", restaurantId)
      .eq("staff_id", staffId)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE),
  );

  const todoFilter = profileId
    ? `actor_staff_id.eq.${staffId},actor_user_id.eq.${profileId}`
    : `actor_staff_id.eq.${staffId}`;
  const todoPromise = rowsOf(
    supabase
      .from("restaurant_staff_todo_log_entries")
      .select("id, action, details, created_at")
      .eq("restaurant_id", restaurantId)
      .or(todoFilter)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE),
  );

  const actorPromise = profileId
    ? Promise.all([
        rowsOf(
          supabase
            .from("restaurant_reservation_log_entries")
            .select("id, action, guest_label, details, created_at")
            .eq("restaurant_id", restaurantId)
            .eq("actor_user_id", profileId)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
        ),
        rowsOf(
          supabase
            .from("accounting_document_log_entries")
            .select("id, document_kind, action, details, created_at")
            .eq("restaurant_id", restaurantId)
            .eq("actor_user_id", profileId)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
        ),
        rowsOf(
          supabase
            .from("restaurant_document_log_entries")
            .select("id, action, document_title, created_at")
            .eq("restaurant_id", restaurantId)
            .eq("actor_user_id", profileId)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
        ),
        rowsOf(
          supabase
            .from("restaurant_staff_work_entry_log_entries")
            .select("id, action, details, created_at")
            .eq("restaurant_id", restaurantId)
            .eq("actor_user_id", profileId)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
        ),
        rowsOf(
          supabase
            .from("restaurant_staff_contract_log_entries")
            .select("id, action, details, created_at")
            .eq("restaurant_id", restaurantId)
            .eq("actor_user_id", profileId)
            .order("created_at", { ascending: false })
            .limit(PER_SOURCE),
        ),
      ])
    : Promise.resolve([[], [], [], [], []] as const);

  const compliancePromise = rowsOf(
    supabase
      .from("restaurant_compliance_log_entries")
      .select("id, action, details, created_at")
      .eq("restaurant_id", restaurantId)
      .or(todoFilter)
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE),
  );

  const staffNamePromise = supabase
    .from("restaurant_staff")
    .select("given_name, family_name")
    .eq("restaurant_id", restaurantId)
    .eq("id", staffId)
    .maybeSingle();

  const [workRows, requestRows, todoRows, complianceRows, staffNameRes, actorRows] =
    await Promise.all([
      workPromise,
      requestPromise,
      todoPromise,
      compliancePromise,
      staffNamePromise,
      actorPromise,
    ]);

  const [reservationRows, accountingRows, documentRows, workLogRows, contractRows] =
    actorRows;

  const items: StaffActivityItem[] = [
    ...workRows.map((row) =>
      staffActivityFromWorkEntry(
        row as {
          id: string;
          entry_type: string;
          starts_at: string;
          ends_at: string;
          is_open?: boolean | null;
          note?: string | null;
        },
      ),
    ),
    ...requestRows.map((row) =>
      staffActivityFromTimeRequest(
        row as {
          id: string;
          entry_type: string | null;
          status: string;
          requested_starts_at: string;
          requested_ends_at: string | null;
          created_at: string;
        },
      ),
    ),
    ...todoRows.map((row) =>
      staffActivityFromTodoLog({
        id: (row as { id: string }).id,
        action: (row as { action: string }).action,
        created_at: (row as { created_at: string }).created_at,
        details: asRecord((row as { details: unknown }).details),
      }),
    ),
    ...complianceRows.map((row) =>
      staffActivityFromComplianceLog({
        id: (row as { id: string }).id,
        action: (row as { action: string }).action,
        created_at: (row as { created_at: string }).created_at,
        details: asRecord((row as { details: unknown }).details),
      }),
    ),
  ];

  for (const raw of reservationRows) {
    const row = raw as {
      id: string;
      action: string;
      guest_label: string;
      details: ReservationLogDetails | null;
      created_at: string;
    };
    const action = row.action as ReservationLogAction;
    const details = row.details ?? {};
    const summary = formatReservationLogDetailsSummary(details, action);
    items.push({
      id: `reservation:${row.id}`,
      at: row.created_at,
      area: "Reservierung",
      title: reservationLogActionLabel(action),
      detail:
        summary && summary !== "—"
          ? `${row.guest_label} · ${summary}`
          : row.guest_label,
    });
  }

  for (const raw of accountingRows) {
    const row = raw as {
      id: string;
      document_kind: AccountingDocumentLogKind;
      action: AccountingDocumentLogAction;
      details: AccountingDocumentLogDetails | null;
      created_at: string;
    };
    const kind =
      row.document_kind === "invoice"
        ? "Rechnung"
        : row.document_kind === "quotation"
          ? "Angebot"
          : "Beleg";
    const details = row.details ?? {};
    const summary = details.summary?.trim();
    items.push({
      id: `accounting:${row.id}`,
      at: row.created_at,
      area: "Buchführung",
      title: `${kind} ${accountingDocumentLogActionLabel(row.action).toLocaleLowerCase("de-DE")}`,
      detail: summary || details.voucherNumber?.trim() || kind,
    });
  }

  for (const raw of documentRows) {
    const row = raw as {
      id: string;
      action: DocumentLogAction;
      document_title: string;
      created_at: string;
    };
    const title =
      row.action === "note_added"
        ? "Notiz"
        : row.action === "note_updated"
          ? "Notiz geändert"
          : documentLogActionLabel(row.action);
    items.push({
      id: `document:${row.id}`,
      at: row.created_at,
      area: "Dokumente",
      title,
      detail: row.document_title,
    });
  }

  for (const raw of workLogRows) {
    const row = raw as {
      id: string;
      action: StaffContractLogAction;
      details: { summary?: string; changes?: StaffAuditLogChange[] } | null;
      created_at: string;
    };
    items.push({
      id: `work-log:${row.id}`,
      at: row.created_at,
      area: "Arbeitszeit",
      title: "Arbeitszeit bearbeitet",
      detail: formatStaffWorkEntryLogDisplaySummary({
        action: row.action,
        details: row.details ?? {},
      }),
    });
  }

  for (const raw of contractRows) {
    const row = raw as {
      id: string;
      action: StaffContractLogAction;
      details: {
        summary?: string;
        changes?: StaffAuditLogChange[];
      } | null;
      created_at: string;
    };
    const details = row.details ?? {};
    items.push({
      id: `contract:${row.id}`,
      at: row.created_at,
      area: "Vertrag",
      title: "Vertrag",
      detail:
        details.summary?.trim() ||
        formatStaffContractLogSummary(row.action, details.changes ?? []),
    });
  }

  const givenName =
    typeof staffNameRes.data?.given_name === "string"
      ? staffNameRes.data.given_name
      : "";
  const familyName =
    typeof staffNameRes.data?.family_name === "string"
      ? staffNameRes.data.family_name
      : "";
  if (`${givenName} ${familyName}`.trim()) {
    const [stockRows, orderRows] = await Promise.all([
      rowsOf(
        supabase
          .from("inventory_stock_log_entries")
          .select("id, ingredient_id, entry, seq")
          .eq("restaurant_id", restaurantId)
          .order("seq", { ascending: false })
          .limit(PER_SOURCE * 8),
      ),
      rowsOf(
        supabase
          .from("inventory_purchase_order_log_entries")
          .select("id, entry, sort_order")
          .eq("restaurant_id", restaurantId)
          .order("sort_order", { ascending: false })
          .limit(PER_SOURCE * 8),
      ),
    ]);

    const matchedStock = stockRows
      .filter((row) =>
        protocolActorMatchesStaff(
          asRecord((row as { entry: unknown }).entry),
          givenName,
          familyName,
        ),
      )
      .sort((a, b) => {
        const atA = text(asRecord((a as { entry: unknown }).entry).at) ?? "";
        const atB = text(asRecord((b as { entry: unknown }).entry).at) ?? "";
        return atB.localeCompare(atA);
      });
    const ingredientIds = [
      ...new Set(
        matchedStock
          .map((row) => (row as { ingredient_id?: string }).ingredient_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const ingredientNameById = new Map<string, string>();
    if (ingredientIds.length > 0) {
      const ingredients = await rowsOf(
        supabase
          .from("inventory_ingredients")
          .select("id, name")
          .eq("restaurant_id", restaurantId)
          .in("id", ingredientIds),
      );
      for (const ingredient of ingredients) {
        const row = ingredient as { id: string; name: string };
        if (row.id && row.name) ingredientNameById.set(row.id, row.name);
      }
    }

    let stockShown = 0;
    for (const raw of matchedStock) {
      if (stockShown >= PER_SOURCE) break;
      const row = raw as { id: string; ingredient_id?: string; entry: unknown };
      const item = staffActivityFromStockLog({
        id: row.id,
        ingredientName: row.ingredient_id
          ? ingredientNameById.get(row.ingredient_id)
          : null,
        entry: asRecord(row.entry),
      });
      if (!item) continue;
      items.push(item);
      stockShown += 1;
    }

    const matchedOrders = orderRows
      .map((raw) => {
        const row = raw as { id: string; entry: unknown };
        return { id: row.id, entry: asRecord(row.entry) };
      })
      .filter((row) => protocolActorMatchesStaff(row.entry, givenName, familyName))
      .sort((a, b) => (text(b.entry.at) ?? "").localeCompare(text(a.entry.at) ?? ""));

    let orderShown = 0;
    for (const row of matchedOrders) {
      if (orderShown >= PER_SOURCE) break;
      const item = staffActivityFromPurchaseOrderLog(row);
      if (!item) continue;
      items.push(item);
      orderShown += 1;
    }
  }

  return composeStaffActivityTimeline(items);
}
