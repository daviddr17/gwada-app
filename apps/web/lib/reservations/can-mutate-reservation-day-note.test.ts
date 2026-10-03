import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canDeleteReservationDayNote,
  canEditReservationDayNote,
} from "./can-mutate-reservation-day-note.ts";

function hasKeys(...keys: string[]) {
  const set = new Set(keys);
  return (key: string) => set.has(key);
}

test("Ersteller darf eigene Tagesnotiz bearbeiten und löschen, auch nur mit Lesen", () => {
  const has = hasKeys("reservations.read");
  assert.equal(canEditReservationDayNote(true, has), true);
  assert.equal(canDeleteReservationDayNote(true, has), true);
});

test("Ohne eigenes Recht darf fremde Tagesnotizen niemand mit nur Lesen ändern", () => {
  const has = hasKeys("reservations.read");
  assert.equal(canEditReservationDayNote(false, has), false);
  assert.equal(canDeleteReservationDayNote(false, has), false);
});

test("Reservierungen Bearbeiten darf fremde Tagesnotizen ändern, Löschen nicht ohne Recht", () => {
  const has = hasKeys("reservations.update");
  assert.equal(canEditReservationDayNote(false, has), true);
  assert.equal(canDeleteReservationDayNote(false, has), false);
});

test("Reservierungen Löschen darf fremde Tagesnotizen löschen, Bearbeiten nicht ohne Recht", () => {
  const has = hasKeys("reservations.delete");
  assert.equal(canEditReservationDayNote(false, has), false);
  assert.equal(canDeleteReservationDayNote(false, has), true);
});

test("Legacy reservations.manage und volle CRUD decken fremde Notizen ab", () => {
  assert.equal(
    canEditReservationDayNote(false, hasKeys("reservations.manage")),
    true,
  );
  assert.equal(
    canDeleteReservationDayNote(false, hasKeys("reservations.manage")),
    true,
  );
  const both = hasKeys("reservations.update", "reservations.delete");
  assert.equal(canEditReservationDayNote(false, both), true);
  assert.equal(canDeleteReservationDayNote(false, both), true);
});
