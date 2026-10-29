import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isPersonalReminderDue,
  nextPersonalReminderDelayMs,
  personalReminderPopupNotesFromRows,
} from "./personal-reminder-due.ts";
import type { RestaurantPersonalNoteRow } from "../types/personal-notes.ts";

function note(
  partial: Partial<RestaurantPersonalNoteRow> &
    Pick<RestaurantPersonalNoteRow, "id" | "remind_at">,
): RestaurantPersonalNoteRow {
  return {
    restaurant_id: "r1",
    profile_id: "u1",
    title: partial.title ?? "Titel",
    body: partial.body ?? null,
    reminded_at: partial.reminded_at ?? null,
    completed_at: partial.completed_at ?? null,
    archived_at: partial.archived_at ?? null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

test("fällig nur mit remind_at in der Vergangenheit und ohne reminded/completed", () => {
  const now = Date.parse("2026-10-29T12:00:00.000Z");
  assert.equal(
    isPersonalReminderDue(
      note({ id: "1", remind_at: "2026-10-29T11:59:00.000Z" }),
      now,
    ),
    true,
  );
  assert.equal(
    isPersonalReminderDue(
      note({ id: "2", remind_at: "2026-10-29T12:01:00.000Z" }),
      now,
    ),
    false,
  );
  assert.equal(
    isPersonalReminderDue(
      note({
        id: "3",
        remind_at: "2026-10-29T11:00:00.000Z",
        reminded_at: "2026-10-29T11:00:01.000Z",
      }),
      now,
    ),
    false,
  );
});

test("Popup-Liste sortiert nach remind_at", () => {
  const now = Date.parse("2026-10-29T12:00:00.000Z");
  const due = personalReminderPopupNotesFromRows(
    [
      note({
        id: "b",
        title: "Später",
        remind_at: "2026-10-29T11:30:00.000Z",
      }),
      note({
        id: "a",
        title: "Früher",
        remind_at: "2026-10-29T11:00:00.000Z",
      }),
      note({
        id: "future",
        remind_at: "2026-10-29T13:00:00.000Z",
      }),
    ],
    now,
  );
  assert.deepEqual(
    due.map((n) => n.id),
    ["a", "b"],
  );
});

test("nächstes Timeout bis zur kommenden Erinnerung", () => {
  const now = Date.parse("2026-10-29T12:00:00.000Z");
  const delay = nextPersonalReminderDelayMs(
    [
      note({ id: "past", remind_at: "2026-10-29T11:00:00.000Z" }),
      note({ id: "next", remind_at: "2026-10-29T12:00:30.000Z" }),
      note({ id: "later", remind_at: "2026-10-29T13:00:00.000Z" }),
    ],
    now,
  );
  assert.equal(delay, 30_000);
});
