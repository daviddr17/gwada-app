import type { ConfirmSloResult } from "./reservation-whatsapp-slo";

export const CRON_LAG_MS: Record<string, number> = {
  "reservation-whatsapp": 12 * 60 * 1000,
  "reservation-email": 12 * 60 * 1000,
  "reservation-whatsapp-slo": 20 * 60 * 1000,
  "notification-deliver": 6 * 60 * 1000,
  "staff-shift-notifications": 12 * 60 * 1000,
  "waha-session-recover": 12 * 60 * 1000,
};

export const WAHA_HANG_CLAIM_MS = 90_000;

export type CronHeartbeatRow = {
  job_name: string;
  last_ok_at: string | null;
  last_error: string | null;
  updated_at: string;
};

export type OutboxHealthRow = {
  restaurant_id: string;
  message_kind: string;
  send_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  claimed_at: string | null;
  last_error: string | null;
};

export type WahaSessionHealthRow = {
  restaurant_id: string;
  status: string | null;
  last_error: string | null;
  waha_session_name: string | null;
};

export type RestaurantOpsRow = {
  restaurantId: string;
  restaurantName: string;
  failedOpen: number;
  retrying: number;
  hungSending: number;
  lastError: string | null;
  wahaStatus: string | null;
};

export type CronLagRow = {
  jobName: string;
  lastOkAt: string | null;
  lastError: string | null;
  lagMs: number | null;
  stale: boolean;
};

export type DeliveryHealthSnapshot = {
  slo: ConfirmSloResult;
  cron: CronLagRow[];
  restaurants: RestaurantOpsRow[];
  wahaHangs: Array<{
    restaurantId: string;
    restaurantName: string;
    status: string | null;
    lastError: string | null;
  }>;
  generatedAt: string;
};

export function cronLagRows(
  heartbeats: readonly CronHeartbeatRow[],
  nowMs = Date.now(),
): CronLagRow[] {
  const byName = new Map(heartbeats.map((h) => [h.job_name, h]));
  return Object.keys(CRON_LAG_MS).map((jobName) => {
    const row = byName.get(jobName);
    const lastOkAt = row?.last_ok_at ?? null;
    const lastOkMs = lastOkAt ? Date.parse(lastOkAt) : NaN;
    const lagMs = Number.isFinite(lastOkMs) ? nowMs - lastOkMs : null;
    const threshold = CRON_LAG_MS[jobName] ?? 12 * 60 * 1000;
    return {
      jobName,
      lastOkAt,
      lastError: row?.last_error ?? null,
      lagMs,
      stale: lagMs == null || lagMs > threshold,
    };
  });
}

export function restaurantOpsRows(params: {
  outbox: readonly OutboxHealthRow[];
  sessions: readonly WahaSessionHealthRow[];
  names: ReadonlyMap<string, string>;
  nowMs?: number;
}): RestaurantOpsRow[] {
  const nowMs = params.nowMs ?? Date.now();
  const byRestaurant = new Map<string, RestaurantOpsRow>();

  const ensure = (restaurantId: string): RestaurantOpsRow => {
    let row = byRestaurant.get(restaurantId);
    if (!row) {
      row = {
        restaurantId,
        restaurantName: params.names.get(restaurantId) ?? restaurantId,
        failedOpen: 0,
        retrying: 0,
        hungSending: 0,
        lastError: null,
        wahaStatus: null,
      };
      byRestaurant.set(restaurantId, row);
    }
    return row;
  };

  for (const row of params.outbox) {
    if (row.sent_at || row.cancelled_at) continue;
    const dest = ensure(row.restaurant_id);
    const claimedMs = row.claimed_at ? Date.parse(row.claimed_at) : NaN;
    const hung =
      row.last_error === "sending" &&
      Number.isFinite(claimedMs) &&
      nowMs - claimedMs > WAHA_HANG_CLAIM_MS;
    if (hung) dest.hungSending += 1;
    else if (
      row.last_error &&
      (row.last_error === "sending" ||
        /timeout|absent|unverified/i.test(row.last_error))
    ) {
      dest.retrying += 1;
    } else if (row.last_error) {
      dest.failedOpen += 1;
    }
    if (row.last_error && row.last_error !== "sending") {
      dest.lastError = row.last_error;
    }
  }

  for (const session of params.sessions) {
    const dest = ensure(session.restaurant_id);
    dest.wahaStatus = session.status;
    if (session.last_error && !dest.lastError) {
      dest.lastError = session.last_error;
    }
  }

  return [...byRestaurant.values()]
    .filter(
      (row) =>
        row.failedOpen > 0 ||
        row.retrying > 0 ||
        row.hungSending > 0 ||
        (row.wahaStatus != null &&
          row.wahaStatus.toLowerCase() !== "working"),
    )
    .sort(
      (a, b) =>
        b.hungSending + b.failedOpen + b.retrying -
        (a.hungSending + a.failedOpen + a.retrying),
    );
}

export function wahaHangRows(params: {
  sessions: readonly WahaSessionHealthRow[];
  names: ReadonlyMap<string, string>;
}): DeliveryHealthSnapshot["wahaHangs"] {
  return params.sessions
    .filter((session) => {
      const status = (session.status ?? "").toLowerCase();
      return status !== "working" || Boolean(session.last_error);
    })
    .map((session) => ({
      restaurantId: session.restaurant_id,
      restaurantName:
        params.names.get(session.restaurant_id) ?? session.restaurant_id,
      status: session.status,
      lastError: session.last_error,
    }));
}
