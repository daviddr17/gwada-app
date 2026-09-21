import assert from "node:assert/strict";
import { test } from "node:test";
import { weekdayLabelForLocale } from "./assistant-weekday-label";

test("weekdayLabelForLocale uses monday…sunday keys, not mon/tue", () => {
  // Short keys like "mon" are not DB weekdays — fall back to raw string.
  assert.equal(weekdayLabelForLocale("mon", "de"), "mon");
  assert.match(weekdayLabelForLocale("monday", "de", "short"), /Mo/);
  assert.match(weekdayLabelForLocale("monday", "de", "long"), /Montag/);
});

test("weekdayLabelForLocale follows UI locale", () => {
  assert.match(weekdayLabelForLocale("tuesday", "en", "long"), /Tuesday/);
  assert.match(weekdayLabelForLocale("tuesday", "fr", "long"), /mardi/i);
  assert.match(weekdayLabelForLocale("friday", "es", "long"), /viernes/i);
});

test("weekdayLabelForLocale falls back for null/unknown", () => {
  assert.equal(weekdayLabelForLocale(null, "de"), "?");
  assert.equal(weekdayLabelForLocale("notaday", "de"), "notaday");
});
