import assert from "node:assert/strict";
import { test } from "node:test";

import {
  closureSpecialHoursWindow,
  isOpeningHoursClosureActiveOnDate,
  toFacebookClosureFields,
  toGoogleOpenInfo,
  validateOpeningHoursClosure,
} from "@/lib/opening-hours/closure";

test("temporary without dates is active every day", () => {
  assert.equal(
    isOpeningHoursClosureActiveOnDate(
      { mode: "temporary", from: null, until: null },
      "2026-01-15",
    ),
    true,
  );
});

test("temporary with season window is inclusive", () => {
  const closure = {
    mode: "temporary" as const,
    from: "2025-11-01",
    until: "2026-03-31",
  };
  assert.equal(isOpeningHoursClosureActiveOnDate(closure, "2025-10-31"), false);
  assert.equal(isOpeningHoursClosureActiveOnDate(closure, "2025-11-01"), true);
  assert.equal(isOpeningHoursClosureActiveOnDate(closure, "2026-03-31"), true);
  assert.equal(isOpeningHoursClosureActiveOnDate(closure, "2026-04-01"), false);
});

test("permanent is always active", () => {
  assert.equal(
    isOpeningHoursClosureActiveOnDate(
      { mode: "permanent", from: null, until: null },
      "2026-07-01",
    ),
    true,
  );
});

test("validateOpeningHoursClosure rejects inverted range", () => {
  assert.match(
    validateOpeningHoursClosure({
      mode: "temporary",
      from: "2026-03-01",
      until: "2026-01-01",
    }) ?? "",
    /Von/,
  );
});

test("toGoogleOpenInfo maps temporary and permanent", () => {
  assert.deepEqual(
    toGoogleOpenInfo(
      { mode: "temporary", from: null, until: null },
      "2026-01-01",
    ),
    { status: "CLOSED_TEMPORARILY", canReopen: true },
  );
  assert.deepEqual(
    toGoogleOpenInfo(
      { mode: "permanent", from: null, until: null },
      "2026-01-01",
    ),
    { status: "CLOSED_PERMANENTLY", canReopen: false },
  );
  assert.deepEqual(
    toGoogleOpenInfo({ mode: "open", from: null, until: null }, "2026-01-01"),
    { status: "OPEN" },
  );
});

test("toFacebookClosureFields maps Meta temporary_status", () => {
  assert.deepEqual(
    toFacebookClosureFields(
      { mode: "temporary", from: "2025-11-01", until: "2026-03-31" },
      "2026-01-15",
    ),
    {
      is_permanently_closed: false,
      temporary_status: "temporarily_closed",
    },
  );
  assert.deepEqual(
    toFacebookClosureFields(
      { mode: "temporary", from: "2025-11-01", until: "2026-03-31" },
      "2026-04-15",
    ),
    {
      is_permanently_closed: false,
      temporary_status: "operating_as_usual",
    },
  );
  assert.deepEqual(
    toFacebookClosureFields(
      { mode: "permanent", from: null, until: null },
      "2026-01-15",
    ),
    { is_permanently_closed: true },
  );
});

test("closureSpecialHoursWindow builds Google season period", () => {
  assert.deepEqual(
    closureSpecialHoursWindow(
      {
        mode: "temporary",
        from: "2025-11-01",
        until: "2026-03-31",
      },
      "2026-01-15",
    ),
    { start: "2026-01-15", end: "2026-03-31" },
  );
  assert.equal(
    closureSpecialHoursWindow(
      { mode: "temporary", from: null, until: null },
      "2026-01-15",
    ),
    null,
  );
});
