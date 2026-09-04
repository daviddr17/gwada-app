import type { ConfirmSloResult } from "./reservation-whatsapp-slo";

export const CRON_LAG_MS: Record<string, number> = {
  "reservation-whatsapp": 12 * 60 * 1000,
  "reservation-email": 12 * 60 * 1000,
  "reservation-whatsapp-slo": 20 * 60 * 1000,
  "notification-deliver": 6 * 60 * 1000,
  "newsletter-send": 8 * 60 * 1000,
  "staff-shift-notifications": 12 * 60 * 1000,
  "waha-session-recover": 12 * 60 * 1000,
  "contact-inbox-sync": 12 * 60 * 1000,
  "reviews-feed-sync": 25 * 60 * 1000,
  "news-feed-sync": 25 * 60 * 1000,
  "accounting-lexoffice-sync": 25 * 60 * 1000,
  /** Wöchentlich Mo 07:00 UTC — nicht wie ein 5-Minuten-Job behandeln. */
  "social-suggestions": 8 * 24 * 60 * 60 * 1000,
};

/** Nur diese Jobs lösen On-Call-Mails aus. GitHub-Sync-Lag bleibt auf dem Ops-Board. */
export const PAGEABLE_CRON_JOBS = new Set([
  "reservation-whatsapp",
  "reservation-email",
  "reservation-whatsapp-slo",
  "notification-deliver",
  "staff-shift-notifications",
  "waha-session-recover",
]);

export function isPageableCronJob(jobName: string): boolean {
  return PAGEABLE_CRON_JOBS.has(jobName);
}

export const CRON_JOB_LABELS: Record<string, string> = {
  "reservation-whatsapp": "Reservierung WhatsApp",
  "reservation-email": "Reservierung E-Mail",
  "reservation-whatsapp-slo": "WhatsApp-SLO",
  "notification-deliver": "Push-Zustellung",
  "newsletter-send": "Newsletter",
  "staff-shift-notifications": "Schicht-Push",
  "waha-session-recover": "WAHA-Recover",
  "contact-inbox-sync": "Kontakt-Inbox",
  "reviews-feed-sync": "Bewertungen-Sync",
  "news-feed-sync": "News-Feed-Sync",
  "accounting-lexoffice-sync": "Lexoffice",
  "social-suggestions": "Social-Vorschläge",
};

export function cronJobLabel(jobName: string): string {
  return CRON_JOB_LABELS[jobName] ?? jobName;
}

export const WAHA_HANG_CLAIM_MS = 90_000;
export const NOTIFICATION_STUCK_MS = 15 * 60 * 1000;

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
  emailFailedOpen: number;
  emailRetrying: number;
  emailHungSending: number;
  notificationsFailed: number;
  notificationsStuck: number;
  lastError: string | null;
  wahaStatus: string | null;
};

export type NotificationHealthRow = {
  restaurant_id: string;
  status: string;
  scheduled_at: string | null;
  last_error: string | null;
};

export type IntegrationOpsRow = {
  restaurantId: string;
  restaurantName: string;
  key: string;
  status: string | null;
  lastError: string | null;
};

export type NewsletterOpsSummary = {
  pending: number;
  overdue: number;
  failed: number;
  lastError: string | null;
};

export type BillingOpsRow = {
  restaurantId: string;
  restaurantName: string;
  status: string;
  pastDueSince: string | null;
};

export type CronLagRow = {
  jobName: string;
  lastOkAt: string | null;
  lastError: string | null;
  lagMs: number | null;
  stale: boolean;
  pageable: boolean;
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
  integrations: IntegrationOpsRow[];
  newsletter: NewsletterOpsSummary;
  billing: BillingOpsRow[];
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
      pageable: isPageableCronJob(jobName),
    };
  });
}

function emptyRestaurantOpsRow(
  restaurantId: string,
  name: string,
): RestaurantOpsRow {
  return {
    restaurantId,
    restaurantName: name,
    failedOpen: 0,
    retrying: 0,
    hungSending: 0,
    emailFailedOpen: 0,
    emailRetrying: 0,
    emailHungSending: 0,
    notificationsFailed: 0,
    notificationsStuck: 0,
    lastError: null,
    wahaStatus: null,
  };
}

function applyOutboxCounts(
  dest: RestaurantOpsRow,
  row: OutboxHealthRow,
  nowMs: number,
  channel: "whatsapp" | "email",
): void {
  if (row.sent_at || row.cancelled_at) return;
  const claimedMs = row.claimed_at ? Date.parse(row.claimed_at) : NaN;
  const hung =
    row.last_error === "sending" &&
    Number.isFinite(claimedMs) &&
    nowMs - claimedMs > WAHA_HANG_CLAIM_MS;
  if (hung) {
    if (channel === "email") dest.emailHungSending += 1;
    else dest.hungSending += 1;
  } else if (
    row.last_error &&
    (row.last_error === "sending" ||
      /timeout|absent|unverified|not_configured/i.test(row.last_error))
  ) {
    if (channel === "email") dest.emailRetrying += 1;
    else dest.retrying += 1;
  } else if (row.last_error) {
    if (channel === "email") dest.emailFailedOpen += 1;
    else dest.failedOpen += 1;
  }
  if (row.last_error && row.last_error !== "sending") {
    dest.lastError = row.last_error;
  }
}

export function restaurantOpsRows(params: {
  outbox: readonly OutboxHealthRow[];
  emailOutbox?: readonly OutboxHealthRow[];
  notifications?: readonly NotificationHealthRow[];
  sessions: readonly WahaSessionHealthRow[];
  names: ReadonlyMap<string, string>;
  nowMs?: number;
}): RestaurantOpsRow[] {
  const nowMs = params.nowMs ?? Date.now();
  const byRestaurant = new Map<string, RestaurantOpsRow>();

  const ensure = (restaurantId: string): RestaurantOpsRow => {
    let row = byRestaurant.get(restaurantId);
    if (!row) {
      row = emptyRestaurantOpsRow(
        restaurantId,
        params.names.get(restaurantId) ?? restaurantId,
      );
      byRestaurant.set(restaurantId, row);
    }
    return row;
  };

  for (const row of params.outbox) {
    applyOutboxCounts(ensure(row.restaurant_id), row, nowMs, "whatsapp");
  }
  for (const row of params.emailOutbox ?? []) {
    applyOutboxCounts(ensure(row.restaurant_id), row, nowMs, "email");
  }
  for (const row of params.notifications ?? []) {
    const dest = ensure(row.restaurant_id);
    if (row.status === "failed") {
      dest.notificationsFailed += 1;
      if (row.last_error) dest.lastError = row.last_error;
      continue;
    }
    if (row.status !== "pending") continue;
    const scheduledMs = row.scheduled_at ? Date.parse(row.scheduled_at) : NaN;
    if (Number.isFinite(scheduledMs) && nowMs - scheduledMs > NOTIFICATION_STUCK_MS) {
      dest.notificationsStuck += 1;
      if (row.last_error) dest.lastError = row.last_error;
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
        row.emailFailedOpen > 0 ||
        row.emailRetrying > 0 ||
        row.emailHungSending > 0 ||
        row.notificationsFailed > 0 ||
        row.notificationsStuck > 0 ||
        (row.wahaStatus != null &&
          row.wahaStatus.toLowerCase() !== "working"),
    )
    .sort(
      (a, b) =>
        b.hungSending +
          b.failedOpen +
          b.retrying +
          b.emailHungSending +
          b.emailFailedOpen +
          b.notificationsStuck -
          (a.hungSending +
            a.failedOpen +
            a.retrying +
            a.emailHungSending +
            a.emailFailedOpen +
            a.notificationsStuck),
    );
}

export function integrationOpsRows(params: {
  rows: readonly {
    restaurant_id: string;
    integration_key: string;
    status: string | null;
    last_error: string | null;
  }[];
  names: ReadonlyMap<string, string>;
}): IntegrationOpsRow[] {
  return params.rows
    .filter((row) => {
      const status = (row.status ?? "").toLowerCase();
      return status !== "working" && status !== "disconnected" && status !== "";
    })
    .map((row) => ({
      restaurantId: row.restaurant_id,
      restaurantName: params.names.get(row.restaurant_id) ?? row.restaurant_id,
      key: row.integration_key,
      status: row.status,
      lastError: row.last_error,
    }));
}

export function newsletterOpsSummary(
  rows: readonly {
    status: string;
    send_at: string | null;
    last_error: string | null;
  }[],
  nowMs = Date.now(),
): NewsletterOpsSummary {
  let pending = 0;
  let overdue = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const row of rows) {
    if (row.status === "failed") {
      failed += 1;
      if (row.last_error) lastError = row.last_error;
      continue;
    }
    if (row.status !== "pending") continue;
    pending += 1;
    const sendMs = row.send_at ? Date.parse(row.send_at) : NaN;
    if (Number.isFinite(sendMs) && nowMs - sendMs > NOTIFICATION_STUCK_MS) {
      overdue += 1;
    }
    if (row.last_error) lastError = row.last_error;
  }
  return { pending, overdue, failed, lastError };
}

export function billingOpsRows(params: {
  rows: readonly {
    restaurant_id: string;
    status: string;
    past_due_since: string | null;
  }[];
  names: ReadonlyMap<string, string>;
}): BillingOpsRow[] {
  return params.rows.map((row) => ({
    restaurantId: row.restaurant_id,
    restaurantName: params.names.get(row.restaurant_id) ?? row.restaurant_id,
    status: row.status,
    pastDueSince: row.past_due_since,
  }));
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

export function isWahaWorkingStatus(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "working";
}

export function workingWahaRestaurantIds(
  sessions: readonly WahaSessionHealthRow[],
): Set<string> {
  return new Set(
    sessions
      .filter((session) => isWahaWorkingStatus(session.status))
      .map((session) => session.restaurant_id)
      .filter(Boolean),
  );
}

export function restaurantNeedsPage(row: RestaurantOpsRow): boolean {
  return (
    row.hungSending > 0 ||
    row.emailHungSending > 0 ||
    row.notificationsStuck > 0
  );
}

export function pageableStaleCronJobs(cron: readonly CronLagRow[]): string[] {
  return cron
    .filter((row) => row.stale && row.pageable)
    .map((row) => row.jobName)
    .sort();
}

export function deliveryHealthNeedsPage(snapshot: {
  slo: { breached: boolean };
  cron: readonly CronLagRow[];
  restaurants: readonly RestaurantOpsRow[];
}): boolean {
  return (
    snapshot.slo.breached ||
    pageableStaleCronJobs(snapshot.cron).length > 0 ||
    snapshot.restaurants.some(restaurantNeedsPage)
  );
}

export function deliveryHealthAlertFingerprint(snapshot: {
  slo: { breached: boolean; late: number };
  cron: readonly CronLagRow[];
  restaurants: readonly RestaurantOpsRow[];
}): string {
  const hung = snapshot.restaurants
    .filter(restaurantNeedsPage)
    .map((row) => row.restaurantId)
    .sort();
  return [
    snapshot.slo.breached ? "slo" : "ok",
    `late:${snapshot.slo.late}`,
    `stale:${pageableStaleCronJobs(snapshot.cron).join(",")}`,
    `hung:${hung.join(",")}`,
  ].join("|");
}
