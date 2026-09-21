import assert from "node:assert/strict";
import { test } from "node:test";
import { integrationSyncErrorMessage } from "./integration-sync-user-messages";

test("Google special-hours Date errors are not labeled as Facebook", () => {
  const msg = integrationSyncErrorMessage(
    `Invalid value at 'special_hours.special_hour_periods[0].start_date' (type.googleapis.com/google.type.Date), "2026-12-25": must be an object`,
  );
  assert.match(msg, /Öffnungszeiten-Format abgelehnt/);
  assert.doesNotMatch(msg, /Facebook/i);
});

test("Facebook format rejection stays platform-neutral for Meta hours errors", () => {
  const msg = integrationSyncErrorMessage(
    "(#100) hours must be an object with day keys",
  );
  assert.match(msg, /Öffnungszeiten-Format abgelehnt/);
  assert.doesNotMatch(msg, /Facebook hat/);
});
