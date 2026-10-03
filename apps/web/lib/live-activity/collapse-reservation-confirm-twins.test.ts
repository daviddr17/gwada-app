import assert from "node:assert/strict";
import { test } from "node:test";

import {
  collapseNamelessReservationConfirmTwins,
  isOptimisticReservationConfirmId,
  shouldReplaceNamelessReservationConfirm,
} from "./collapse-reservation-confirm-twins.ts";
import type { LiveActivityItem } from "./live-activity-types.ts";

function row(
  partial: Pick<LiveActivityItem, "id" | "title" | "description"> &
    Partial<LiveActivityItem>,
): LiveActivityItem {
  return {
    kind: "notification",
    module: "reservations_activity",
    href: null,
    at: "2026-10-03T00:21:00.000Z",
    ...partial,
  };
}

test("drops nameless confirm when a named twin has the same status line", () => {
  const named = row({
    id: "log:named-2665",
    title: "David Dreyer · Reservierung bestätigt",
    description: "#2665 · Lara Stanzel · Status: „Offen“ → „Bestätigt“",
  });
  const nameless = row({
    id: "log:local-confirm:2665",
    title: "Reservierung bestätigt",
    description: named.description,
  });
  const other = row({
    id: "log:other",
    title: "David Dreyer · Reservierung geändert",
    description: "#2667 · Anderer Gast · Status: „Offen“ → „Bestätigt“",
  });
  const po = row({
    id: "evt:po",
    module: "inventory_po_activity",
    title: "Bestellung abgeschlossen",
    description: "12 Positionen",
  });

  const collapsed = collapseNamelessReservationConfirmTwins([
    named,
    nameless,
    other,
    po,
  ]);
  assert.deepEqual(
    collapsed.map((item) => item.id),
    ["log:named-2665", "log:other", "evt:po"],
  );
});

test("keeps a nameless confirm when there is no named twin", () => {
  const nameless = row({
    id: "log:only",
    title: "Reservierung bestätigt",
    description: "#1 · Gast · Status: „Offen“ → „Bestätigt“",
  });
  assert.deepEqual(collapseNamelessReservationConfirmTwins([nameless]), [
    nameless,
  ]);
});

test("does not collapse two named confirms for different reservations", () => {
  const a = row({
    id: "log:a",
    title: "David Dreyer · Reservierung bestätigt",
    description: "#2665 · Lara Stanzel · Status: „Offen“ → „Bestätigt“",
  });
  const b = row({
    id: "log:b",
    title: "David Dreyer · Reservierung bestätigt",
    description: "#2666 · Peter Machat · Status: „Offen“ → „Bestätigt“",
  });
  assert.equal(collapseNamelessReservationConfirmTwins([a, b]).length, 2);
});

test("replaces nameless confirm with named twin", () => {
  assert.equal(
    shouldReplaceNamelessReservationConfirm(
      {
        module: "reservations_activity",
        title: "Reservierung bestätigt",
        description: "#2665 · Lara Stanzel · Status: „Offen“ → „Bestätigt“",
      },
      {
        module: "reservations_activity",
        title: "David Dreyer · Reservierung bestätigt",
        description: "#2665 · Lara Stanzel · Status: „Offen“ → „Bestätigt“",
      },
    ),
    true,
  );
});

test("treats log:local-confirm ids as optimistic", () => {
  assert.equal(isOptimisticReservationConfirmId("log:local-confirm:abc"), true);
  assert.equal(isOptimisticReservationConfirmId("log:uuid-real"), false);
});
