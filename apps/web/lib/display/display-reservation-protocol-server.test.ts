import assert from "node:assert/strict";
import test from "node:test";
import type { RestaurantReservationLogEntry } from "@/lib/types/reservation-log";
import {
  formatReservationLogActorLabel,
  formatReservationLogDetailsSummary,
  reservationLogActionLabel,
} from "@/lib/types/reservation-log";

test("protocol labels cover create and update chronology", () => {
  const created: RestaurantReservationLogEntry = {
    id: "1",
    restaurant_id: "r1",
    reservation_id: "res1",
    actor_user_id: "u1",
    action: "created",
    reservation_number: 12,
    guest_label: "#12 · Max Mustermann",
    details: {
      actorGivenName: "Anna",
      actorFamilyName: "Schmidt",
      actorSource: "display",
      summary: "Über Display angelegt",
    },
    created_at: "2026-10-01T10:00:00.000Z",
  };
  const updated: RestaurantReservationLogEntry = {
    id: "2",
    restaurant_id: "r1",
    reservation_id: "res1",
    actor_user_id: "u1",
    action: "updated",
    reservation_number: 12,
    guest_label: "#12 · Max Mustermann",
    details: {
      actorGivenName: "Anna",
      actorFamilyName: "Schmidt",
      actorSource: "display",
      changes: [
        {
          field: "party_size",
          label: "Personen",
          from: "2",
          to: "4",
        },
      ],
    },
    created_at: "2026-10-01T11:00:00.000Z",
  };

  const timeline = [created, updated];
  assert.equal(reservationLogActionLabel(timeline[0]!.action), "Angelegt");
  assert.equal(
    formatReservationLogActorLabel(timeline[0]!.details),
    "Anna Schmidt · Display",
  );
  assert.equal(
    formatReservationLogDetailsSummary(timeline[0]!.details, timeline[0]!.action),
    "Über Display angelegt",
  );
  assert.equal(reservationLogActionLabel(timeline[1]!.action), "Geändert");
  assert.match(
    formatReservationLogDetailsSummary(timeline[1]!.details, timeline[1]!.action),
    /Personen/,
  );
  assert.ok(
    new Date(timeline[0]!.created_at).getTime() <
      new Date(timeline[1]!.created_at).getTime(),
  );
});
