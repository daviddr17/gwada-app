import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isPureCancellationStatusChange,
  shouldEmitReservationLogLiveActivity,
} from "./reservation-log-live-activity.ts";

test("emits status confirm updates", () => {
  assert.equal(
    shouldEmitReservationLogLiveActivity({
      action: "updated",
      details: {
        actorSource: "staff",
        changes: [
          {
            field: "status",
            label: "Status",
            from: "Ausstehend",
            to: "Bestätigt",
          },
        ],
      },
    }),
    true,
  );
});

test("skips pure cancellation (covered by reservations_cancellation)", () => {
  assert.equal(
    shouldEmitReservationLogLiveActivity({
      action: "updated",
      details: {
        changes: [
          {
            field: "status",
            label: "Status",
            from: "Bestätigt",
            to: "Storniert",
          },
        ],
      },
    }),
    false,
  );
  assert.equal(
    isPureCancellationStatusChange({
      changes: [
        {
          field: "status",
          label: "Status",
          from: "Bestätigt",
          to: "Storniert",
        },
      ],
    }),
    true,
  );
});

test("skips guest-created and change_request_submitted", () => {
  assert.equal(
    shouldEmitReservationLogLiveActivity({
      action: "created",
      details: { actorSource: "guest" },
    }),
    false,
  );
  assert.equal(
    shouldEmitReservationLogLiveActivity({
      action: "change_request_submitted",
    }),
    false,
  );
});
