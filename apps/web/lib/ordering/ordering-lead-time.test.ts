import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  earliestReadyAt,
  formatOrderTimingLabelDe,
  resolveGuestOrderTiming,
} from "./ordering-lead-time.ts";

const settings = {
  pickupLeadMinutes: 20,
  deliveryLeadMinutes: 45,
};

describe("ordering-lead-time", () => {
  it("computes earliest from Mindestvorlauf", () => {
    const now = Date.parse("2026-10-21T12:00:00.000Z");
    const pickup = earliestReadyAt(settings, "pickup", now);
    assert.equal(pickup.toISOString(), "2026-10-21T12:20:00.000Z");
    const delivery = earliestReadyAt(settings, "delivery", now);
    assert.equal(delivery.toISOString(), "2026-10-21T12:45:00.000Z");
  });

  it("forces ASAP for kiosk", () => {
    const now = Date.parse("2026-10-21T12:00:00.000Z");
    const result = resolveGuestOrderTiming({
      channel: "kiosk",
      fulfillment: "pickup",
      settings,
      timingMode: "scheduled",
      scheduledAt: "2026-10-21T18:00:00.000Z",
      nowMs: now,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fulfillmentAsap, true);
    assert.equal(result.slotStartAt, "2026-10-21T12:20:00.000Z");
  });

  it("accepts Wunschzeit after earliest for online", () => {
    const now = Date.parse("2026-10-21T12:00:00.000Z");
    const result = resolveGuestOrderTiming({
      channel: "online",
      fulfillment: "pickup",
      settings,
      timingMode: "scheduled",
      scheduledAt: "2026-10-21T15:00:00.000Z",
      nowMs: now,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.fulfillmentAsap, false);
    assert.equal(result.slotStartAt, "2026-10-21T15:00:00.000Z");
  });

  it("rejects Wunschzeit before earliest", () => {
    const now = Date.parse("2026-10-21T12:00:00.000Z");
    const result = resolveGuestOrderTiming({
      channel: "online",
      fulfillment: "pickup",
      settings,
      timingMode: "scheduled",
      scheduledAt: "2026-10-21T12:05:00.000Z",
      nowMs: now,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "scheduled_before_earliest");
  });

  it("labels ASAP and Wunschzeit in German", () => {
    assert.equal(
      formatOrderTimingLabelDe({
        fulfillmentAsap: true,
        slotStartAt: null,
      }),
      "Schnellstmöglich",
    );
    assert.match(
      formatOrderTimingLabelDe({
        fulfillmentAsap: false,
        slotStartAt: "2026-10-21T15:30:00.000Z",
      }),
      /^Wunschzeit:/,
    );
  });
});
