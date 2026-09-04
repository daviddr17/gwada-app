import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONFIRM_SLO_MS,
  computeConfirmSlo,
} from "./reservation-whatsapp-slo.ts";

const now = Date.parse("2026-09-04T12:00:00.000Z");

function row(
  kind: string,
  sendAt: string,
  sentAt: string | null,
): {
  message_kind: string;
  send_at: string;
  sent_at: string | null;
  cancelled_at: string | null;
} {
  return {
    message_kind: kind,
    send_at: sendAt,
    sent_at: sentAt,
    cancelled_at: null,
  };
}

test("99% of confirms within 30s meets SLO", () => {
  const rows = Array.from({ length: 100 }, (_, i) =>
    row(
      "confirmed",
      "2026-09-04T11:50:00.000Z",
      i === 0
        ? "2026-09-04T11:51:00.000Z"
        : "2026-09-04T11:50:10.000Z",
    ),
  );
  const slo = computeConfirmSlo(rows, now);
  assert.equal(slo.sample, 100);
  assert.equal(slo.onTime, 99);
  assert.equal(slo.breached, false);
});

test("breaches when too many confirms are late or still pending", () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    row(
      "confirmed",
      "2026-09-04T11:50:00.000Z",
      i < 3 ? "2026-09-04T11:50:10.000Z" : null,
    ),
  );
  const slo = computeConfirmSlo(rows, now);
  assert.equal(slo.sample, 10);
  assert.equal(slo.late, 7);
  assert.equal(slo.breached, true);
});

test("ignores reminders and cancelled rows", () => {
  const rows = [
    {
      ...row("reminder", "2026-09-04T11:00:00.000Z", null),
    },
    {
      ...row("confirmed", "2026-09-04T11:50:00.000Z", "2026-09-04T11:50:05.000Z"),
      cancelled_at: "2026-09-04T11:50:01.000Z",
    },
  ];
  const slo = computeConfirmSlo(rows, now);
  assert.equal(slo.sample, 0);
  assert.equal(slo.breached, false);
  assert.ok(CONFIRM_SLO_MS === 30_000);
});
