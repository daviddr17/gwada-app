import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WAHA_SESSION_WEBHOOK_EVENTS } from "@/lib/integrations/waha-webhook-events";

describe("WAHA_SESSION_WEBHOOK_EVENTS", () => {
  it("includes message.any for phone outbound mirroring", () => {
    assert.ok(WAHA_SESSION_WEBHOOK_EVENTS.includes("message"));
    assert.ok(WAHA_SESSION_WEBHOOK_EVENTS.includes("message.any"));
    assert.ok(WAHA_SESSION_WEBHOOK_EVENTS.includes("message.ack"));
  });
});
