import type { SupabaseClient } from "@supabase/supabase-js";

export type ReservationWhatsappOutboxHealth = {
  sent24h: number;
  dueScheduled: number;
  failedOpen: number;
  retrying: number;
  lastSentAt: string | null;
  lastError: string | null;
};

const EMPTY: ReservationWhatsappOutboxHealth = {
  sent24h: 0,
  dueScheduled: 0,
  failedOpen: 0,
  retrying: 0,
  lastSentAt: null,
  lastError: null,
};

export async function loadReservationWhatsappOutboxHealth(
  sb: SupabaseClient,
  restaurantId?: string | null,
): Promise<ReservationWhatsappOutboxHealth> {
  let query = sb
    .from("reservation_whatsapp_outbox")
    .select(
      "message_kind, send_at, sent_at, cancelled_at, claimed_at, last_error",
    )
    .gte("send_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .limit(800);

  if (restaurantId) {
    query = query.eq("restaurant_id", restaurantId);
  }

  const { data, error } = await query;
  if (error || !data) return EMPTY;

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  let sent24h = 0;
  let dueScheduled = 0;
  let failedOpen = 0;
  let retrying = 0;
  let lastSentAt: string | null = null;
  let lastError: string | null = null;
  let lastErrorAt = 0;

  for (const raw of data) {
    const row = raw as {
      message_kind: string;
      send_at: string | null;
      sent_at: string | null;
      cancelled_at: string | null;
      claimed_at: string | null;
      last_error: string | null;
    };
    if (row.sent_at) {
      const sentMs = Date.parse(row.sent_at);
      if (Number.isFinite(sentMs) && sentMs >= dayAgo) sent24h += 1;
      if (!lastSentAt || row.sent_at > lastSentAt) lastSentAt = row.sent_at;
      continue;
    }
    if (row.cancelled_at) continue;

    const sendMs = row.send_at ? Date.parse(row.send_at) : NaN;
    const due = Number.isFinite(sendMs) && sendMs <= now;
    const scheduled =
      row.message_kind === "reminder" || row.message_kind === "thanks";

    if (due && scheduled && !row.last_error) {
      dueScheduled += 1;
    } else if (row.last_error) {
      if (
        row.last_error === "sending" ||
        /timeout|absent|unverified/i.test(row.last_error)
      ) {
        retrying += 1;
      } else {
        failedOpen += 1;
      }
      const errAt = Number.isFinite(sendMs) ? sendMs : 0;
      if (errAt >= lastErrorAt) {
        lastErrorAt = errAt;
        lastError = row.last_error;
      }
    } else if (due && scheduled) {
      dueScheduled += 1;
    }
  }

  return {
    sent24h,
    dueScheduled,
    failedOpen,
    retrying,
    lastSentAt,
    lastError,
  };
}
