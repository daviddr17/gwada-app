import assert from "node:assert/strict";
import { test } from "node:test";

import {
  composeStaffActivityTimeline,
  mergeStaffActivityItems,
  protocolActorMatchesStaff,
  staffActivityFromPurchaseOrderLog,
  staffActivityFromStockLog,
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

test("Bestand nennt Zutat und Mengen", () => {
  const item = staffActivityFromStockLog({
    id: "s1",
    ingredientName: "Tomaten",
    entry: {
      at: "2026-09-21T10:00:00.000Z",
      kind: "manual_stock",
      fromQuantity: 2,
      toQuantity: 0.5,
      unitLabel: "kg",
      userFirstName: "Mia",
      userLastName: "Klein",
    },
  });
  assert.equal(item?.area, "Bestand");
  assert.equal(item?.title, "Bestand geändert");
  assert.match(item?.detail ?? "", /Tomaten/);
  assert.match(item?.detail ?? "", /2 kg → 0,5 kg/);
});

test("Bestellung erkennt den Mitarbeiter am Protokollnamen", () => {
  const entry = {
    at: "2026-09-21T11:00:00.000Z",
    kind: "add_to_order",
    ingredientName: "Mehl",
    quantity: 3,
    unitLabel: "kg",
    userFirstName: "Mia",
    userLastName: "Klein",
  };
  assert.equal(protocolActorMatchesStaff(entry, "Mia", "Klein"), true);
  assert.equal(protocolActorMatchesStaff(entry, "Max", "Klein"), false);
  const item = staffActivityFromPurchaseOrderLog({ id: "p1", entry });
  assert.equal(item?.area, "Bestellung");
  assert.equal(item?.title, "Zur Bestellung");
  assert.match(item?.detail ?? "", /Mehl/);
});

test("Dashboard-Aktionen bleiben neben vielen Display-Einträgen", () => {
  const time = Array.from({ length: 30 }, (_, i) => ({
    id: `work:${i}`,
    at: `2026-09-21T${String(10 + (i % 10)).padStart(2, "0")}:00:00.000Z`,
    area: "Arbeitszeit",
    title: "Arbeitszeit",
    detail: "am Display",
  }));
  const stock = {
    id: "stock:1",
    at: "2026-09-01T10:00:00.000Z",
    area: "Bestand",
    title: "Bestand geändert",
    detail: "Tomaten",
  };
  const items = composeStaffActivityTimeline([...time, stock]);
  assert.ok(items.some((item) => item.id === "stock:1"));
});
