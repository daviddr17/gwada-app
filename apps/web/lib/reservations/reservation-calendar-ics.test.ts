import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildReservationCalendarIcs,
  reservationCalendarFactsChanged,
  reservationCalendarFilename,
  reservationCalendarFingerprint,
  reservationCalendarUid,
  resolveReservationCalendarTimeZone,
} from "./reservation-calendar-ics.ts";

const reservationId = "11111111-2222-4333-8444-555555555555";

function sampleIcs(sequence = 0) {
  return buildReservationCalendarIcs({
    reservationId,
    reservationNumber: 42,
    sequence,
    timeZone: "Europe/Berlin",
    startsAt: new Date("2026-09-25T17:00:00.000Z"),
    endsAt: new Date("2026-09-25T19:00:00.000Z"),
    partySize: 4,
    guestFirstName: "Ada",
    guestLastName: "Lovelace",
    guestEmail: "ada@example.com",
    restaurantName: "Zur Schlagd",
    restaurantEmail: "tisch@zurschlagd.example",
    location: "Schlagdstraße 1, 34497 Korbach",
    now: new Date("2026-09-01T10:00:00.000Z"),
  });
}

test("ICS ist METHOD:REQUEST mit fester UID und Europe/Berlin", () => {
  const ics = sampleIcs(0);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /METHOD:REQUEST/);
  assert.match(ics, new RegExp(`UID:${reservationCalendarUid(reservationId)}`));
  assert.match(ics, /TZID:Europe\/Berlin\r\n/);
  assert.match(ics, /RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\n/);
  assert.match(ics, /END:VTIMEZONE\r\nBEGIN:VEVENT\r\n/);
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260925T190000/);
  assert.match(ics, /DTEND;TZID=Europe\/Berlin:20260925T210000/);
  assert.match(ics, /SEQUENCE:0/);
  assert.match(ics, /STATUS:CONFIRMED/);
  assert.match(ics, /LOCATION:Schlagdstraße 1\\, 34497 Korbach/);
  assert.match(ics, /Personen: 4/);
  assert.match(ics, /Gast: Ada Lovelace/);
  assert.match(ics, /Restaurant: Zur Schlagd/);
  assert.match(ics, /mailto:ada@example.com/);
  assert.match(ics, /mailto:tisch@zurschlagd.example/);
  assert.equal(ics.endsWith("\r\n"), true);
});

test("gleiche UID, höhere SEQUENCE", () => {
  const first = sampleIcs(0);
  const next = sampleIcs(2);
  const uid = reservationCalendarUid(reservationId);
  assert.match(first, new RegExp(`UID:${uid}`));
  assert.match(next, new RegExp(`UID:${uid}`));
  assert.match(next, /SEQUENCE:2/);
  assert.equal(reservationCalendarFilename(42), "Reservierung-42.ics");
});

test("Fingerprint steigt bei Zeit, Personenzahl und Ort, nicht bei ISO-Schreibweise", () => {
  const base = {
    startsAt: "2026-09-25T17:00:00.000Z",
    endsAt: "2026-09-25T19:00:00.000Z",
    partySize: 2,
    diningTableId: null as string | null,
    location: "Hauptstraße 1",
  };
  const same = reservationCalendarFingerprint({
    ...base,
    startsAt: "2026-09-25T17:00:00+00:00",
  });
  assert.equal(reservationCalendarFingerprint(base), same);
  assert.notEqual(
    reservationCalendarFingerprint(base),
    reservationCalendarFingerprint({ ...base, partySize: 3 }),
  );
  assert.notEqual(
    reservationCalendarFingerprint(base),
    reservationCalendarFingerprint({
      ...base,
      startsAt: "2026-09-25T18:00:00.000Z",
    }),
  );
  assert.notEqual(
    reservationCalendarFingerprint(base),
    reservationCalendarFingerprint({ ...base, location: "Andere Straße 2" }),
  );
});

test("Facts-Vergleich erkennt Termin, Ende, Personen und Tisch", () => {
  const before = {
    starts_at: "2026-09-25T17:00:00.000Z",
    ends_at: "2026-09-25T19:00:00.000Z",
    party_size: 2,
    dining_table_id: null as string | null,
  };
  assert.equal(reservationCalendarFactsChanged(before, { ...before }), false);
  assert.equal(
    reservationCalendarFactsChanged(before, { ...before, party_size: 5 }),
    true,
  );
  assert.equal(
    reservationCalendarFactsChanged(before, {
      ...before,
      dining_table_id: "table-1",
    }),
    true,
  );
});

test("ungültige Zeitzone fällt auf Europe/Berlin", () => {
  assert.equal(resolveReservationCalendarTimeZone("Europe/Berlin"), "Europe/Berlin");
  assert.equal(resolveReservationCalendarTimeZone("Not/AZone"), "Europe/Berlin");
  assert.equal(resolveReservationCalendarTimeZone("  "), "Europe/Berlin");
});
