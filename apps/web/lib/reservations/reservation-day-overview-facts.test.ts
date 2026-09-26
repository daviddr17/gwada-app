import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatReservationDaySheetSummary,
  reservationDayOverviewFacts,
} from "./reservation-day-overview-facts.ts";

test("Tageskopf zählt Gäste, Veranstaltungen und Personen, nicht Verschoben-Marker", () => {
  const facts = reservationDayOverviewFacts([
    { id: "a", party_size: 2, kind: "guest" },
    { id: "b", party_size: 4, kind: "guest" },
    { id: "relocated:a", party_size: 9, kind: "guest" },
    { id: "e", party_size: 12, kind: "private_event" },
  ]);
  assert.deepEqual(facts, {
    reservationCount: 2,
    eventCount: 1,
    partySize: 18,
  });
});

test("Leerer Tag bleibt bei null, ohne erfundene Zahlen", () => {
  assert.deepEqual(reservationDayOverviewFacts([]), {
    reservationCount: 0,
    eventCount: 0,
    partySize: 0,
  });
});

test("Tagesblatt-Zeile zeigt Mitarbeiter, Reservierungen und Personen, auch bei 0", () => {
  assert.equal(
    formatReservationDaySheetSummary({
      staffCount: 0,
      reservationCount: 0,
      eventCount: 0,
      partySize: 0,
    }),
    "0 Mitarbeiter · 0 Reservierungen · 0 Personen",
  );
  assert.equal(
    formatReservationDaySheetSummary({
      staffCount: 1,
      reservationCount: 1,
      eventCount: 0,
      partySize: 1,
    }),
    "1 Mitarbeiter · 1 Reservierung · 1 Person",
  );
});

test("Veranstaltung steht nur, wenn welche da sind; Mitarbeiter fehlen, solange unbekannt", () => {
  assert.equal(
    formatReservationDaySheetSummary({
      staffCount: 3,
      reservationCount: 2,
      eventCount: 1,
      partySize: 18,
    }),
    "3 Mitarbeiter · 2 Reservierungen · 1 Veranstaltung · 18 Personen",
  );
  assert.equal(
    formatReservationDaySheetSummary({
      staffCount: null,
      reservationCount: 2,
      eventCount: 0,
      partySize: 6,
    }),
    "2 Reservierungen · 6 Personen",
  );
});
