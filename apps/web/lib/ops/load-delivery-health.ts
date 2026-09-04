import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  billingOpsRows,
  cronLagRows,
  integrationOpsRows,
  newsletterOpsSummary,
  restaurantOpsRows,
  wahaHangRows,
  workingWahaRestaurantIds,
  type CronHeartbeatRow,
  type DeliveryHealthSnapshot,
  type NotificationHealthRow,
  type OutboxHealthRow,
  type WahaSessionHealthRow,
} from "@/lib/ops/delivery-health";
import { isMetaReviewDemoRestaurantSlug } from "@/lib/restaurants/meta-review-demo";
import { computeConfirmSlo } from "@/lib/ops/reservation-whatsapp-slo";
import { sanitizeOpsText } from "@/lib/ops/sanitize-ops-text";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function mapOutbox(rows: unknown[]): OutboxHealthRow[] {
  return rows.map((raw) => {
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
}

export async function loadDeliveryHealthSnapshot(
  admin: SupabaseClient,
): Promise<DeliveryHealthSnapshot> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [
    outboxRes,
    emailOutboxRes,
    heartbeatRes,
    sessionRes,
    oauthRes,
    notificationRes,
    newsletterRes,
    billingRes,
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
      .from("reservation_email_outbox")
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
    admin
      .from("restaurant_integrations")
      .select("restaurant_id, integration_key, status, last_error")
      .in("integration_key", ["google_business", "facebook", "instagram"]),
    admin
      .from("notification_deliveries")
      .select("context_restaurant_id, status, scheduled_at, last_error")
      .in("status", ["pending", "failed"])
      .gte("created_at", since)
      .limit(2000),
    admin
      .from("platform_newsletter_outbox")
      .select("status, send_at, last_error")
      .in("status", ["pending", "failed"])
      .limit(500),
    admin
      .from("restaurant_subscriptions")
      .select("restaurant_id, status, past_due_since")
      .in("status", ["past_due", "unpaid"]),
    admin.from("restaurants").select("id, name, slug"),
  ]);

  const names = new Map<string, string>();
  const demoRestaurantIds = new Set<string>();
  for (const raw of restaurantRes.data ?? []) {
    const row = asRecord(raw);
    if (!row || typeof row.id !== "string") continue;
    names.set(row.id, typeof row.name === "string" ? row.name : row.id);
    if (isMetaReviewDemoRestaurantSlug(typeof row.slug === "string" ? row.slug : null)) {
      demoRestaurantIds.add(row.id);
    }
  }

  const outbox = mapOutbox(outboxRes.data ?? []);
  const emailOutbox = mapOutbox(emailOutboxRes.data ?? []);

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

  const notifications: NotificationHealthRow[] = (notificationRes.data ?? []).map(
    (raw) => {
      const row = asRecord(raw) ?? {};
      return {
        restaurant_id: String(row.context_restaurant_id ?? ""),
        status: String(row.status ?? ""),
        scheduled_at:
          typeof row.scheduled_at === "string" ? row.scheduled_at : null,
        last_error:
          typeof row.last_error === "string"
            ? sanitizeOpsText(row.last_error)
            : null,
      };
    },
  );

  const sloRows = (outboxRes.data ?? []).map((raw) => {
    const row = asRecord(raw) ?? {};
    return {
      restaurant_id: String(row.restaurant_id ?? ""),
      message_kind: String(row.message_kind ?? ""),
      send_at: typeof row.send_at === "string" ? row.send_at : null,
      sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
      cancelled_at: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
      created_at: null,
    };
  });

  const sloRestaurantIds = workingWahaRestaurantIds(sessions);
  for (const id of demoRestaurantIds) sloRestaurantIds.delete(id);

  return {
    slo: computeConfirmSlo(sloRows, Date.now(), {
      includeRestaurantIds: sloRestaurantIds,
    }),
    cron: cronLagRows(heartbeats),
    restaurants: restaurantOpsRows({
      outbox,
      emailOutbox,
      notifications,
      sessions,
      names,
    }),
    wahaHangs: wahaHangRows({ sessions, names }),
    integrations: integrationOpsRows({
      rows: (oauthRes.data ?? []).map((raw) => {
        const row = asRecord(raw) ?? {};
        return {
          restaurant_id: String(row.restaurant_id ?? ""),
          integration_key: String(row.integration_key ?? ""),
          status: typeof row.status === "string" ? row.status : null,
          last_error:
            typeof row.last_error === "string"
              ? sanitizeOpsText(row.last_error)
              : null,
        };
      }),
      names,
    }),
    newsletter: newsletterOpsSummary(
      (newsletterRes.data ?? []).map((raw) => {
        const row = asRecord(raw) ?? {};
        return {
          status: String(row.status ?? ""),
          send_at: typeof row.send_at === "string" ? row.send_at : null,
          last_error:
            typeof row.last_error === "string"
              ? sanitizeOpsText(row.last_error)
              : null,
        };
      }),
    ),
    billing: billingOpsRows({
      rows: (billingRes.data ?? []).map((raw) => {
        const row = asRecord(raw) ?? {};
        return {
          restaurant_id: String(row.restaurant_id ?? ""),
          status: String(row.status ?? ""),
          past_due_since:
            typeof row.past_due_since === "string" ? row.past_due_since : null,
        };
      }),
      names,
    }),
    generatedAt: new Date().toISOString(),
  };
}
