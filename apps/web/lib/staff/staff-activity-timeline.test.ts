import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mergeStaffActivityItems,
  staffActivityFromTimeRequest,
  staffActivityFromWorkEntry,
} from "./staff-activity-timeline";

test("offene Display-Pause nennt seit-Uhrzeit", () => {
  const item = staffActivityFromWorkEntry({
    id: "e1",
    entry_type: "break",
    starts_at: "2026-09-21T10:00:00.000Z",
    ends_at: "2026-09-21T10:00:00.000Z",
    is_open: true,
    note: "Display",
  });
  assert.equal(item.title, "Pause");
  assert.equal(item.area, "Arbeitszeit");
  assert.match(item.detail, /seit 12:00/);
  assert.match(item.detail, /am Display/);
});

test("Nachtrag nennt Zeitraum und Status", () => {
  const item = staffActivityFromTimeRequest({
    id: "r1",
    entry_type: "work",
    status: "pending",
    requested_starts_at: "2026-09-21T08:00:00.000Z",
    requested_ends_at: "2026-09-21T16:00:00.000Z",
    created_at: "2026-09-21T16:05:00.000Z",
  });
  assert.equal(item.title, "Zeit nachtragen");
  assert.match(item.detail, /Arbeitszeit/);
  assert.match(item.detail, /10:00–18:00/);
  assert.match(item.detail, /angefragt/);
});

test("Aktivität sortiert neueste zuerst und kürzt", () => {
  const items = mergeStaffActivityItems(
    [
      {
        id: "a",
        at: "2026-09-01T10:00:00.000Z",
        area: "Arbeitszeit",
        title: "Alt",
        detail: "alt",
      },
      {
        id: "b",
        at: "2026-09-21T10:00:00.000Z",
        area: "Checkliste",
        title: "Neu",
        detail: "neu",
      },
      {
        id: "a",
        at: "2026-09-01T10:00:00.000Z",
        area: "Arbeitszeit",
        title: "Alt",
        detail: "alt",
      },
    ],
    1,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.id, "b");
});
