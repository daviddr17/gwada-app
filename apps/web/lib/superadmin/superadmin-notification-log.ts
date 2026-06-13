import {
  isNotificationModuleId,
  NOTIFICATION_MODULES,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SuperadminNotificationLogRow = {
  row_kind: "delivery" | "event_only";
  delivery_id: string | null;
  event_id: string;
  event_created_at: string;
  event_processed_at: string | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
  context_restaurant_id: string | null;
  context_restaurant_name: string | null;
  module: string;
  reference_id: string;
  payload: Record<string, unknown>;
  profile_id: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  channel: "whatsapp" | "email" | null;
  delivery_status: string | null;
  delivery_attempts: number | null;
  last_error: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  delivery_created_at: string | null;
  idempotency_key: string | null;
};

export function notificationModuleLabel(module: string): string {
  if (isNotificationModuleId(module)) {
    return NOTIFICATION_MODULES[module].label;
  }
  return module;
}

export function notificationChannelLabel(
  channel: SuperadminNotificationLogRow["channel"],
): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return "E-Mail";
  return "—";
}

export function notificationDeliveryStatusLabel(status: string | null): string {
  switch (status) {
    case "sent":
      return "Gesendet";
    case "failed":
      return "Fehlgeschlagen";
    case "pending":
      return "Ausstehend";
    case "processing":
      return "In Arbeit";
    default:
      return status ?? "—";
  }
}

export function formatNotificationLogDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatNotificationPayloadSummary(
  module: string,
  payload: Record<string, unknown>,
): string {
  const p = payload ?? {};

  if (module === "reviews") {
    const parts = [
      typeof p.authorName === "string" ? p.authorName : null,
      typeof p.rating === "number" && p.rating > 0
        ? `${Math.round(p.rating)}★`
        : null,
      typeof p.platform === "string" ? p.platform : null,
    ].filter(Boolean);
    const preview =
      typeof p.commentPreview === "string" && p.commentPreview.trim()
        ? ` — „${p.commentPreview.trim()}“`
        : "";
    return (parts.join(" · ") || "Bewertung") + preview;
  }

  if (module === "messages") {
    const name =
      typeof p.contactName === "string" ? p.contactName : "Kontakt";
    const preview =
      typeof p.preview === "string" && p.preview.trim()
        ? ` — „${p.preview.trim()}“`
        : "";
    return `${name}${preview}`;
  }

  if (
    module === "reservations_pending" ||
    module === "reservations_change_request" ||
    module === "reservations_cancellation"
  ) {
    const guest = typeof p.guestLabel === "string" ? p.guestLabel : "Gast";
    const party =
      typeof p.partySize === "number" ? ` · ${p.partySize} Pers.` : "";
    return `${guest}${party}`;
  }

  if (module === "staff_shift_start" || module === "staff_shift_end") {
    return typeof p.staffName === "string" ? p.staffName : "Mitarbeiter";
  }

  if (module === "inventory_low_stock") {
    const name =
      typeof p.ingredientName === "string" ? p.ingredientName : "Zutat";
    return name;
  }

  if (module === "changelog") {
    return typeof p.title === "string" ? p.title : "Changelog";
  }

  const raw = JSON.stringify(p);
  if (!raw || raw === "{}") return "—";
  return raw.length > 100 ? `${raw.slice(0, 100)}…` : raw;
}

export function restaurantLabelForLogRow(row: SuperadminNotificationLogRow): string {
  return (
    row.restaurant_name?.trim() ||
    row.context_restaurant_name?.trim() ||
    row.restaurant_id?.slice(0, 8) ||
    "Plattform"
  );
}

export function recipientLabelForLogRow(row: SuperadminNotificationLogRow): string {
  if (row.row_kind === "event_only") {
    if (row.last_error === "event_pending") return "Event noch nicht verarbeitet";
    return "Kein Versand (Push aus?)";
  }
  const name = row.recipient_name?.trim();
  const email = row.recipient_email?.trim();
  if (name && email) return `${name} · ${email}`;
  return name || email || row.profile_id?.slice(0, 8) || "—";
}

export function primaryTimestampForLogRow(row: SuperadminNotificationLogRow): string {
  return row.sent_at ?? row.delivery_created_at ?? row.event_created_at;
}

export type SuperadminNotificationLogFilters = {
  limit?: number;
  offset?: number;
  search?: string;
  module?: string;
  channel?: string;
  status?: string;
};

export type SuperadminNotificationLogResult = {
  rows: SuperadminNotificationLogRow[];
  totalCount: number;
  error: string | null;
};

export async function fetchSuperadminNotificationLog(
  sb: SupabaseClient,
  options?: SuperadminNotificationLogFilters,
): Promise<SuperadminNotificationLogResult> {
  const { data, error } = await sb.rpc("superadmin_list_notification_log", {
    p_limit: options?.limit ?? 50,
    p_offset: options?.offset ?? 0,
    p_search: options?.search?.trim() || null,
    p_module: options?.module && options.module !== "all" ? options.module : null,
    p_channel:
      options?.channel && options.channel !== "all" ? options.channel : null,
    p_status:
      options?.status && options.status !== "all" ? options.status : null,
  });

  if (error) return { rows: [], totalCount: 0, error: error.message };

  let totalCount = 0;
  const rows = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    if (typeof row.total_count === "number") {
      totalCount = row.total_count;
    } else if (typeof row.total_count === "string") {
      totalCount = Number(row.total_count) || 0;
    }
    return {
      row_kind: row.row_kind === "event_only" ? "event_only" : "delivery",
      delivery_id: (row.delivery_id as string | null) ?? null,
      event_id: String(row.event_id),
      event_created_at: String(row.event_created_at),
      event_processed_at: (row.event_processed_at as string | null) ?? null,
      restaurant_id: (row.restaurant_id as string | null) ?? null,
      restaurant_name: (row.restaurant_name as string | null) ?? null,
      context_restaurant_id: (row.context_restaurant_id as string | null) ?? null,
      context_restaurant_name: (row.context_restaurant_name as string | null) ?? null,
      module: String(row.module),
      reference_id: String(row.reference_id),
      payload:
        row.payload &&
        typeof row.payload === "object" &&
        !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {},
      profile_id: (row.profile_id as string | null) ?? null,
      recipient_email: (row.recipient_email as string | null) ?? null,
      recipient_name: (row.recipient_name as string | null) ?? null,
      channel:
        row.channel === "whatsapp" || row.channel === "email"
          ? row.channel
          : null,
      delivery_status: (row.delivery_status as string | null) ?? null,
      delivery_attempts:
        typeof row.delivery_attempts === "number"
          ? row.delivery_attempts
          : null,
      last_error: (row.last_error as string | null) ?? null,
      scheduled_at: (row.scheduled_at as string | null) ?? null,
      sent_at: (row.sent_at as string | null) ?? null,
      delivery_created_at: (row.delivery_created_at as string | null) ?? null,
      idempotency_key: (row.idempotency_key as string | null) ?? null,
    } satisfies SuperadminNotificationLogRow;
  });

  return { rows, totalCount, error: null };
}

export function isKnownNotificationModule(
  module: string,
): module is NotificationModuleId {
  return isNotificationModuleId(module);
}
