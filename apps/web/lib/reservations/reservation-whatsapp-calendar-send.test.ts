import assert from "node:assert/strict";
import { test } from "node:test";

import { shouldSendReservationConfirmationText } from "./reservation-whatsapp-calendar-send.ts";

test("confirmation text still sends when the calendar file is missing or rejected", () => {
  assert.equal(
    shouldSendReservationConfirmationText({
      calendarAttached: false,
      alreadyDelivered: false,
    }),
    true,
  );
});

test("no second text when the calendar message was accepted", () => {
  assert.equal(
    shouldSendReservationConfirmationText({
      calendarAttached: true,
      alreadyDelivered: false,
    }),
    false,
  );
});

test("no second text when the confirmation is already in the chat", () => {
  assert.equal(
    shouldSendReservationConfirmationText({
      calendarAttached: false,
      alreadyDelivered: true,
    }),
    false,
  );
});
