import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cronLagRows,
  restaurantOpsRows,
  wahaHangRows,
  type CronHeartbeatRow,
  type DeliveryHealthSnapshot,
  type OutboxHealthRow,
  type WahaSessionHealthRow,
} from "@/lib/ops/delivery-health";
import { computeConfirmSlo } from "@/lib/ops/reservation-whatsapp-slo";
import { sanitizeOpsText } from "@/lib/ops/sanitize-ops-text";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function loadDeliveryHealthSnapshot(
  admin: SupabaseClient,
): Promise<DeliveryHealthSnapshot> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [
    outboxRes,
    heartbeatRes,
    sessionRes,
    restaurantRes,
  ] = await Promise.all([
    admin
      .from("reservation_whatsapp_outbox")
      .select(
        "restaurant_id, message_kind, send_at, sent_at, cancelled_at, claimed_at, last_error",
      )
      .gte("send_at", since)
      .limit(2000),
    admin
      .from("platform_cron_heartbeats")
      .select("job_name, last_ok_at, last_error, updated_at"),
    admin
      .from("restaurant_integrations")
      .select("restaurant_id, status, last_error, waha_session_name")
      .eq("integration_key", "whatsapp"),
    admin.from("restaurants").select("id, name"),
  ]);

  const names = new Map<string, string>();
  for (const raw of restaurantRes.data ?? []) {
    const row = asRecord(raw);
    if (!row || typeof row.id !== "string") continue;
    names.set(row.id, typeof row.name === "string" ? row.name : row.id);
  }

  const outbox: OutboxHealthRow[] = (outboxRes.data ?? []).map((raw) => {
    const row = asRecord(raw) ?? {};
    return {
      restaurant_id: String(row.restaurant_id ?? ""),
      message_kind: String(row.message_kind ?? ""),
      send_at: typeof row.send_at === "string" ? row.send_at : null,
      sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
      cancelled_at: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
      claimed_at: typeof row.claimed_at === "string" ? row.claimed_at : null,
      last_error:
        typeof row.last_error === "string"
          ? sanitizeOpsText(row.last_error)
          : null,
    };
  });

  const heartbeats: CronHeartbeatRow[] = (heartbeatRes.data ?? []).map((raw) => {
    const row = asRecord(raw) ?? {};
    return {
      job_name: String(row.job_name ?? ""),
      last_ok_at: typeof row.last_ok_at === "string" ? row.last_ok_at : null,
      last_error:
        typeof row.last_error === "string"
          ? sanitizeOpsText(row.last_error)
          : null,
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    };
  });

  const sessions: WahaSessionHealthRow[] = (sessionRes.data ?? []).map((raw) => {
    const row = asRecord(raw) ?? {};
    return {
      restaurant_id: String(row.restaurant_id ?? ""),
      status: typeof row.status === "string" ? row.status : null,
      last_error:
        typeof row.last_error === "string"
          ? sanitizeOpsText(row.last_error)
          : null,
      waha_session_name:
        typeof row.waha_session_name === "string" ? row.waha_session_name : null,
    };
  });

  const sloRows = (outboxRes.data ?? []).map((raw) => {
    const row = asRecord(raw) ?? {};
    return {
      message_kind: String(row.message_kind ?? ""),
      send_at: typeof row.send_at === "string" ? row.send_at : null,
      sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
      cancelled_at: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
      created_at: null,
    };
  });

  return {
    slo: computeConfirmSlo(sloRows),
    cron: cronLagRows(heartbeats),
    restaurants: restaurantOpsRows({ outbox, sessions, names }),
    wahaHangs: wahaHangRows({ sessions, names }),
    generatedAt: new Date().toISOString(),
  };
}
