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

  const [workRows, requestRows, todoRows, actorRows] = await Promise.all([
    workPromise,
    requestPromise,
    todoPromise,
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

  return mergeStaffActivityItems(items);
}
