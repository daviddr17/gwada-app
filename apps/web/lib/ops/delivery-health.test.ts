import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cronLagRows,
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
  assert.equal(email?.stale, true);
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
