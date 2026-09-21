import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeReservationReminderSendAt,
  computeReservationThanksSendAt,
  isReservationOutboxSendAtTooStale,
  isReservationReminderTooLate,
  resolveReservationThanksSendAt,
  shouldScheduleReservationReminder,
} from "./reservation-timed-notification-schedule.ts";

test("Danke: Fr 28.08.2026 18:45 Europe/Berlin (CEST) + 2h → 20:45", () => {
  const startsAt = "2026-08-28T16:45:00.000Z";
  const sendAt = computeReservationThanksSendAt(startsAt, 2);
  assert.equal(sendAt.toISOString(), "2026-08-28T18:45:00.000Z");
});

test("Erinnerung: Fr 28.08.2026 18:45 Berlin − 24h → Do 27.08. 18:45", () => {
  const startsAt = "2026-08-28T16:45:00.000Z";
  const sendAt = computeReservationReminderSendAt(startsAt, 24);
  assert.equal(sendAt.toISOString(), "2026-08-27T16:45:00.000Z");
});

test("Danke über Mitternacht: 23:30 Berlin + 2h → nächster Tag 01:30", () => {
  const startsAt = "2026-08-28T21:30:00.000Z";
  const sendAt = computeReservationThanksSendAt(startsAt, 2);
  assert.equal(sendAt.toISOString(), "2026-08-28T23:30:00.000Z");
});

test("Danke nach DST-Umstellung (CET): 28.10.2026 18:45 + 2h → 20:45 Berlin", () => {
  const startsAt = "2026-10-28T17:45:00.000Z";
  const sendAt = computeReservationThanksSendAt(startsAt, 2);
  assert.equal(sendAt.toISOString(), "2026-10-28T19:45:00.000Z");
});

test("resolveReservationThanksSendAt: Vergangenheit → jetzt", () => {
  const startsAt = "2020-01-01T11:00:00.000Z";
  const now = new Date("2026-08-31T12:00:00.000Z");
  const sendAt = resolveReservationThanksSendAt(startsAt, 2, now);
  assert.equal(sendAt.getTime(), now.getTime());
});

test("shouldScheduleReservationReminder: Vergangenheit → false", () => {
  const now = new Date("2026-08-31T12:00:00.000Z");
  const past = new Date("2026-08-30T12:00:00.000Z");
  assert.equal(shouldScheduleReservationReminder(past, now), false);
});

test("isReservationReminderTooLate: Termin begonnen → true", () => {
  const now = new Date("2026-09-04T12:00:00.000Z");
  assert.equal(
    isReservationReminderTooLate("2026-09-04T11:00:00.000Z", now),
    true,
  );
  assert.equal(
    isReservationReminderTooLate("2026-09-04T13:00:00.000Z", now),
    false,
  );
});

test("isReservationOutboxSendAtTooStale: >36h nach send_at → true", () => {
  const now = new Date("2026-09-04T12:00:00.000Z");
  assert.equal(
    isReservationOutboxSendAtTooStale("2026-09-02T12:00:00.000Z", now),
    true,
  );
  assert.equal(
    isReservationOutboxSendAtTooStale("2026-09-03T12:00:00.000Z", now),
    false,
  );
});
