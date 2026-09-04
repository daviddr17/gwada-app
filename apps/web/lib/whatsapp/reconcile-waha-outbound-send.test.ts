import assert from "node:assert/strict";
import { test } from "node:test";

import {
  WAHA_IMMEDIATE_RETRY_WINDOW_MS,
  WAHA_RECONCILE_GRACE_MS,
  WAHA_UNKNOWN_HOLD_MS,
  decideWhatsappRetry,
  findMatchingFromMeWahaMessage,
  isWahaSendTimeoutError,
  outboundTextMatchesWahaBody,
  wahaChatMessageTimestampMs,
} from "./reconcile-waha-outbound-send.ts";

test("timeout error detection", () => {
  assert.equal(
    isWahaSendTimeoutError("The operation was aborted due to timeout"),
    true,
  );
  assert.equal(isWahaSendTimeoutError("waha_send_500"), false);
});

test("body match ignores extra whitespace", () => {
  assert.equal(
    outboundTextMatchesWahaBody("Hallo  Anna", "Hallo Anna"),
    true,
  );
  assert.equal(outboundTextMatchesWahaBody("A", "B"), false);
});

test("finds fromMe message after since, ignores older", () => {
  const since = Date.parse("2026-09-04T10:00:00.000Z");
  const hit = findMatchingFromMeWahaMessage(
    [
      {
        id: "old",
        fromMe: true,
        body: "Reservierung bestätigt",
        timestamp: since / 1000 - 3600,
      },
      {
        id: "true_jid_abc",
        fromMe: true,
        body: "Reservierung bestätigt",
        timestamp: since / 1000 + 5,
      },
    ],
    "Reservierung bestätigt",
    since,
  );
  assert.equal(hit?.id, "true_jid_abc");
});

test("waha timestamps: seconds vs ms", () => {
  assert.equal(wahaChatMessageTimestampMs(1_700_000_000), 1_700_000_000_000);
  assert.equal(wahaChatMessageTimestampMs(1_700_000_000_000), 1_700_000_000_000);
});

test("retry: confirmed is always already_sent", () => {
  assert.equal(
    decideWhatsappRetry({
      evidence: "confirmed",
      firstSendAtMs: Date.now() - 60_000,
      claimedAtMs: Date.now(),
    }),
    "already_sent",
  );
});

test("retry: absent after grace → retry_now", () => {
  const first = Date.now() - 5 * 60_000;
  assert.equal(
    decideWhatsappRetry({
      evidence: "absent",
      firstSendAtMs: first,
      claimedAtMs: Date.now() - WAHA_RECONCILE_GRACE_MS - 1,
      nowMs: Date.now(),
    }),
    "retry_now",
  );
});

test("retry: absent inside grace → wait", () => {
  const now = Date.now();
  assert.equal(
    decideWhatsappRetry({
      evidence: "absent",
      firstSendAtMs: now - 10_000,
      claimedAtMs: now - 1_000,
      nowMs: now,
    }),
    "wait",
  );
});

test("retry: unknown after hold → give_up (no blind resend)", () => {
  const now = Date.now();
  assert.equal(
    decideWhatsappRetry({
      evidence: "unknown",
      firstSendAtMs: now - WAHA_UNKNOWN_HOLD_MS - 1_000,
      claimedAtMs: now - WAHA_UNKNOWN_HOLD_MS - 1_000,
      nowMs: now,
    }),
    "give_up",
  );
});

test("retry: older than window → give_up", () => {
  const now = Date.now();
  assert.equal(
    decideWhatsappRetry({
      evidence: "absent",
      firstSendAtMs: now - WAHA_IMMEDIATE_RETRY_WINDOW_MS - 1,
      claimedAtMs: null,
      nowMs: now,
    }),
    "give_up",
  );
});
