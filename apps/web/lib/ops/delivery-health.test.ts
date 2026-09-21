import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cronJobLabel,
  cronLagRows,
  deliveryHealthNeedsPage,
  integrationOpsRows,
  newsletterOpsSummary,
  restaurantOpsRows,
  wahaHangRows,
} from "./delivery-health.ts";

const now = Date.parse("2026-09-04T12:00:00.000Z");

test("marks cron jobs stale when heartbeat is old or missing", () => {
  const rows = cronLagRows(
    [
      {
        job_name: "reservation-whatsapp",
        last_ok_at: "2026-09-04T11:59:00.000Z",
        last_error: null,
        updated_at: "2026-09-04T11:59:00.000Z",
      },
    ],
    now,
  );
  const wa = rows.find((r) => r.jobName === "reservation-whatsapp");
  const email = rows.find((r) => r.jobName === "reservation-email");
  assert.equal(wa?.stale, false);
  assert.equal(wa?.pageable, true);
  assert.equal(email?.stale, true);
  const social = rows.find((r) => r.jobName === "social-suggestions");
  assert.equal(social?.stale, true);
  assert.equal(social?.pageable, false);
});

test("weekly social-suggestions is not stale after two days", () => {
  const rows = cronLagRows(
    [
      {
        job_name: "social-suggestions",
        last_ok_at: "2026-09-02T07:00:00.000Z",
        last_error: null,
        updated_at: "2026-09-02T07:00:00.000Z",
      },
    ],
    now,
  );
  assert.equal(rows.find((r) => r.jobName === "social-suggestions")?.stale, false);
});

test("GitHub sync lag does not page when delivery crons and SLO are fine", () => {
  const cron = cronLagRows(
    [
      {
        job_name: "reservation-whatsapp",
        last_ok_at: "2026-09-04T11:59:00.000Z",
        last_error: null,
        updated_at: "2026-09-04T11:59:00.000Z",
      },
      {
        job_name: "reservation-email",
        last_ok_at: "2026-09-04T11:59:00.000Z",
        last_error: null,
        updated_at: "2026-09-04T11:59:00.000Z",
      },
      {
        job_name: "reservation-whatsapp-slo",
        last_ok_at: "2026-09-04T11:59:00.000Z",
        last_error: null,
        updated_at: "2026-09-04T11:59:00.000Z",
      },
      {
        job_name: "notification-deliver",
        last_ok_at: "2026-09-04T11:59:00.000Z",
        last_error: null,
        updated_at: "2026-09-04T11:59:00.000Z",
      },
      {
        job_name: "staff-shift-notifications",
        last_ok_at: "2026-09-04T11:59:00.000Z",
        last_error: null,
        updated_at: "2026-09-04T11:59:00.000Z",
      },
      {
        job_name: "waha-session-recover",
        last_ok_at: "2026-09-04T11:59:00.000Z",
        last_error: null,
        updated_at: "2026-09-04T11:59:00.000Z",
      },
    ],
    now,
  );
  assert.equal(cron.find((r) => r.jobName === "contact-inbox-sync")?.stale, true);
  assert.equal(
    deliveryHealthNeedsPage({
      slo: { breached: false },
      cron,
      restaurants: [],
    }),
    false,
  );
  assert.equal(
    deliveryHealthNeedsPage({
      slo: { breached: true },
      cron,
      restaurants: [],
    }),
    true,
  );
});

test("groups restaurants that are not sending or hanging", () => {
  const rows = restaurantOpsRows({
    nowMs: now,
    names: new Map([["r1", "Zur Schlagd"]]),
    sessions: [{ restaurant_id: "r1", status: "WORKING", last_error: null, waha_session_name: "s" }],
    outbox: [
      {
        restaurant_id: "r1",
        message_kind: "confirmed",
        send_at: "2026-09-04T11:50:00.000Z",
        sent_at: null,
        cancelled_at: null,
        claimed_at: "2026-09-04T11:50:00.000Z",
        last_error: "sending",
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.restaurantName, "Zur Schlagd");
  assert.equal(rows[0]?.hungSending, 1);
});

test("includes email outbox and stuck notifications on the restaurant row", () => {
  const rows = restaurantOpsRows({
    nowMs: now,
    names: new Map([["r1", "Zur Schlagd"]]),
    sessions: [],
    outbox: [],
    emailOutbox: [
      {
        restaurant_id: "r1",
        message_kind: "reminder",
        send_at: "2026-09-04T11:50:00.000Z",
        sent_at: null,
        cancelled_at: null,
        claimed_at: "2026-09-04T11:50:00.000Z",
        last_error: "sending",
      },
    ],
    notifications: [
      {
        restaurant_id: "r1",
        status: "pending",
        scheduled_at: "2026-09-04T11:30:00.000Z",
        last_error: null,
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.emailHungSending, 1);
  assert.equal(rows[0]?.notificationsStuck, 1);
});

test("lists broken OAuth integrations and overdue newsletter rows", () => {
  const integrations = integrationOpsRows({
    names: new Map([["r1", "Zur Schlagd"]]),
    rows: [
      {
        restaurant_id: "r1",
        integration_key: "google_business",
        status: "error",
        last_error: "token_expired",
      },
      {
        restaurant_id: "r1",
        integration_key: "facebook",
        status: "working",
        last_error: null,
      },
    ],
  });
  assert.equal(integrations.length, 1);
  assert.equal(integrations[0]?.key, "google_business");

  const newsletter = newsletterOpsSummary(
    [
      {
        status: "pending",
        send_at: "2026-09-04T11:30:00.000Z",
        last_error: null,
      },
      { status: "failed", send_at: null, last_error: "smtp_timeout" },
    ],
    now,
  );
  assert.equal(newsletter.pending, 1);
  assert.equal(newsletter.overdue, 1);
  assert.equal(newsletter.failed, 1);
  assert.equal(cronJobLabel("contact-inbox-sync"), "Kontakt-Inbox");
});

test("lists WAHA sessions that are not working", () => {
  const hangs = wahaHangRows({
    names: new Map([["r1", "Zur Schlagd"]]),
    sessions: [
      { restaurant_id: "r1", status: "FAILED", last_error: "timeout", waha_session_name: "s" },
      { restaurant_id: "r2", status: "WORKING", last_error: null, waha_session_name: "ok" },
    ],
  });
  assert.equal(hangs.length, 1);
  assert.equal(hangs[0]?.status, "FAILED");
});
