import assert from "node:assert/strict";
import { test } from "node:test";

import {
  alertRepeatCooldownMs,
  ALERT_COOLDOWN_MS,
  ALERT_SLO_UNCHANGED_REPEAT_MS,
  encodeAlertFingerprint,
  opsAlertSubject,
  parseAlertFingerprintState,
} from "./ops-alert-escalation.ts";

test("first alert starts at count 1", () => {
  const parsed = parseAlertFingerprintState(null, "slo|late:2");
  assert.equal(parsed.sameIssue, false);
  assert.equal(parsed.nextCount, 1);
  assert.equal(opsAlertSubject({ sloBreached: true, escalationCount: 1 }).includes("ESKALATION"), false);
});

test("same fingerprint increments and marks escalation", () => {
  const stored = encodeAlertFingerprint("slo|late:2", 1);
  const parsed = parseAlertFingerprintState(stored, "slo|late:2");
  assert.equal(parsed.sameIssue, true);
  assert.equal(parsed.nextCount, 2);
  assert.match(
    opsAlertSubject({ sloBreached: true, escalationCount: parsed.nextCount }),
    /^ESKALATION 2x — /,
  );
});

test("different fingerprint resets count", () => {
  const stored = encodeAlertFingerprint("slo|late:2", 4);
  const parsed = parseAlertFingerprintState(stored, "ok|late:0");
  assert.equal(parsed.sameIssue, false);
  assert.equal(parsed.nextCount, 1);
});

test("unchanged 24h SLO waits a day, acute issues stay on the short cooldown", () => {
  assert.equal(
    alertRepeatCooldownMs("slo|late:2|stale:|hung:"),
    ALERT_SLO_UNCHANGED_REPEAT_MS,
  );
  assert.equal(
    alertRepeatCooldownMs("slo|late:3|stale:notification-deliver|hung:"),
    ALERT_COOLDOWN_MS,
  );
  assert.equal(
    alertRepeatCooldownMs("ok|late:0|stale:|hung:abc"),
    ALERT_COOLDOWN_MS,
  );
});
