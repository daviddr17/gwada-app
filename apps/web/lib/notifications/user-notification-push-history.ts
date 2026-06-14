import {
  formatNotificationPayloadSummary,
  notificationChannelLabel,
  notificationModuleLabel,
} from "@/lib/superadmin/superadmin-notification-log";

export type UserNotificationPushHistoryRow = {
  id: string;
  occurredAt: string;
  eventLabel: string;
  channelLabel: string;
  content: string;
  status: "sent" | "failed";
};

export type UserNotificationPushHistoryResult = {
  rows: UserNotificationPushHistoryRow[];
  totalCount: number;
};

type RpcRow = {
  delivery_id: string;
  occurred_at: string;
  channel: "whatsapp" | "email";
  delivery_status: string;
  module: string;
  payload: Record<string, unknown> | null;
  last_error: string | null;
  total_count: number | string;
};

function mapPushHistoryRow(row: RpcRow): UserNotificationPushHistoryRow {
  const payload = row.payload ?? {};
  let content = formatNotificationPayloadSummary(row.module, payload);
  if (row.delivery_status === "failed") {
    const err = row.last_error?.trim();
    content = err
      ? `${content} — Fehlgeschlagen: ${err.length > 120 ? `${err.slice(0, 120)}…` : err}`
      : `${content} — Zustellung fehlgeschlagen`;
  }

  return {
    id: row.delivery_id,
    occurredAt: row.occurred_at,
    eventLabel: notificationModuleLabel(row.module),
    channelLabel: notificationChannelLabel(row.channel),
    content,
    status: row.delivery_status === "failed" ? "failed" : "sent",
  };
}

export function mapUserNotificationPushHistoryRows(
  data: RpcRow[] | null | undefined,
): UserNotificationPushHistoryResult {
  const rows = (data ?? []).map(mapPushHistoryRow);
  const totalRaw = data?.[0]?.total_count;
  const totalCount =
    typeof totalRaw === "number"
      ? totalRaw
      : typeof totalRaw === "string"
        ? Number.parseInt(totalRaw, 10) || rows.length
        : rows.length;

  return { rows, totalCount };
}

export function formatUserPushHistoryWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
